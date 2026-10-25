import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import prisma from "../src/config/prisma";
import { pdfFixture } from "./pdf-fixture";
import { analyze } from "../src/services/analysis";
vi.mock("@clerk/express", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  clerkClient: {
    users: {
      getUser: vi.fn().mockResolvedValue({
        primaryEmailAddressId: "email-1",
        emailAddresses: [
          {
            id: "email-1",
            emailAddress: "test@example.invalid",
            verification: { status: "verified" },
          },
        ],
      }),
    },
  },
}));
vi.mock("../src/config/aws", () => ({
  s3: {
    send: vi.fn(async () => ({
      Body: {
        transformToByteArray: async () => new Uint8Array(await pdfFixture()),
      },
    })),
  },
}));
import { processReminderBatch, consoleProvider } from "../src/jobs/reminders";
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue("https://private.example.invalid/temporary-download"),
}));
const app = createApp({
  auth: (req, res, next) => {
    const user = req.header("x-test-user");
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.locals.userId = user;
    next();
  },
});
const as = (
  method: "get" | "post" | "patch" | "delete",
  path: string,
  user = "alice",
) => request(app)[method](path).set("x-test-user", user);
let id: string;
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
    throw new Error("Use the isolated test database runner");
  await prisma.analysis.deleteMany();
  await prisma.jobApplication.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());
describe("real PostgreSQL API behavior", () => {
  it("returns JSON 401 before parsing uploads or writing data", async () => {
    expect((await request(app).post("/api/applications").send({})).status).toBe(
      401,
    );
    expect((await request(app).post("/api/resumes")).status).toBe(401);
  });
  it("creates a scoped record and its structured event atomically", async () => {
    const r = await as("post", "/api/applications").send({
      company: "Acme",
      role: "Engineer",
      appliedDate: "2026-10-01",
      status: "Applied",
      followUpAt: "2026-10-01T09:00:00Z",
    });
    expect(r.status).toBe(201);
    id = r.body.id;
    expect(
      await prisma.activity.count({
        where: { applicationId: id, kind: "APPLICATION_CREATED" },
      }),
    ).toBe(1);
  });
  it("rejects attempts to change ownership", async () => {
    const r = await as("patch", `/api/applications/${id}`).send({
      userId: "bob",
    });
    expect(r.status).toBe(400);
    expect(
      (await prisma.jobApplication.findUnique({ where: { id } }))?.userId,
    ).toBe("alice");
  });
  it("isolates reads, writes, deletes, scheduling and exports across users", async () => {
    for (const method of ["get", "patch", "delete"] as const) {
      const r =
        method === "patch"
          ? await as(method, `/api/applications/${id}`, "bob").send({
              notes: "intrusion",
            })
          : await as(method, `/api/applications/${id}`, "bob");
      expect(r.status).toBe(404);
    }
    expect((await as("get", "/api/applications", "bob")).body.total).toBe(0);
    expect(
      (await as("get", "/api/applications/export", "bob")).text,
    ).not.toContain("Acme");
    expect(
      (
        await as("post", `/api/applications/${id}/interviews`, "bob").send({
          title: "Round",
          startsAt: "2026-12-01T17:00:00Z",
          timeZone: "UTC",
          type: "video",
        })
      ).status,
    ).toBe(404);
  });
  it("filters and paginates on the server", async () => {
    await as("post", "/api/applications").send({
      company: "Beta",
      role: "Designer",
      appliedDate: "2026-09-30",
      status: "Offer",
      location: "Remote",
    });
    const r = await as(
      "get",
      "/api/applications?search=engineer&pageSize=1&sort=company&direction=asc",
    );
    expect(r.body.total).toBe(1);
    expect(r.body.items[0].company).toBe("Acme");
    expect((await as("get", "/api/applications?pageSize=1000")).status).toBe(
      400,
    );
  });
  it("records actual status and note changes", async () => {
    expect(
      (
        await as("patch", `/api/applications/${id}`).send({
          status: "Offer",
          notes: "Actual offer",
        })
      ).status,
    ).toBe(200);
    const r = await as("get", `/api/applications/${id}`);
    expect(
      r.body.activities.some(
        (a: { kind: string }) => a.kind === "OFFER_RECEIVED",
      ),
    ).toBe(true);
    expect(
      r.body.activities.some(
        (a: { kind: string }) => a.kind === "NOTES_UPDATED",
      ),
    ).toBe(true);
  });
  it("uses actual calendar months and scopes dashboard queries", async () => {
    const r = await as("get", "/api/dashboard");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.counts.Offer).toBe(2);
    expect(r.body.monthly).toEqual([
      { date: "2026-09", count: 1 },
      { date: "2026-10", count: 1 },
    ]);
    expect((await as("get", "/api/dashboard", "bob")).body.total).toBe(0);
  });
  it("schedules rounds with unique reminders and completion events", async () => {
    const r = await as("post", `/api/applications/${id}/interviews`).send({
      title: "Technical",
      startsAt: "2026-12-01T17:00:00Z",
      timeZone: "America/Los_Angeles",
      type: "technical",
      reminderMinutes: 60,
    });
    expect(r.status).toBe(201);
    expect(
      await prisma.reminder.count({ where: { interviewId: r.body.id } }),
    ).toBe(1);
    const done = await as(
      "patch",
      `/api/applications/${id}/interviews/${r.body.id}`,
    ).send({ status: "Completed" });
    expect(done.status).toBe(200);
    expect(
      await prisma.reminder.count({ where: { interviewId: r.body.id } }),
    ).toBe(0);
  });
  it("imports atomically and exports safe CSV", async () => {
    const invalid = await as("post", "/api/applications/import").send({
      csv: "company,role,appliedDate\nOkay,Engineer,2026-10-01\nMissing,,2026-10-01",
    });
    expect(invalid.status).toBe(400);
    expect(
      await prisma.jobApplication.count({ where: { company: "Okay" } }),
    ).toBe(0);
    const valid = await as("post", "/api/applications/import").send({
      csv: "company,role,appliedDate\n=Formula,Engineer,2026-10-01",
    });
    expect(valid.status).toBe(201);
    expect((await as("get", "/api/applications/export")).text).toContain(
      "'=Formula",
    );
  });
  it("guards resume ownership, upload size and file signature", async () => {
    expect(
      (
        await as("post", "/api/resumes")
          .field("name", "Resume")
          .attach("resume", Buffer.from("fake"), {
            filename: "test.pdf",
            contentType: "application/pdf",
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await as("post", "/api/resumes")
          .field("name", "Resume")
          .attach("resume", Buffer.alloc(5 * 1024 * 1024 + 1), {
            filename: "test.pdf",
            contentType: "application/pdf",
          })
      ).status,
    ).toBe(400);
    await prisma.resume.create({
      data: {
        id: "private-resume",
        userId: "alice",
        name: "Private",
        fileKey: "legacy-key.pdf",
        fileUrl: "https://legacy.invalid/key",
      },
    });
    for (const [method, path] of [
      ["get", "/api/resumes/private-resume/download"],
      ["delete", "/api/resumes/private-resume"],
    ] as const)
      expect((await as(method, path, "bob")).status).toBe(404);
    expect((await as("get", "/api/resumes", "bob")).body).toEqual([]);
    expect(
      (
        await as("post", "/api/analyses", "bob").send({
          resumeId: "private-resume",
          jobDescription:
            "We need an engineer with React and TypeScript skills.",
          consent: false,
        })
      ).status,
    ).toBe(404);
  });
  it("uploads, privately downloads, analyzes and deletes a PDF through scoped endpoints", async () => {
    process.env.AWS_BUCKET_NAME = "test-bucket";
    process.env.AI_MODE = "demo";
    const r = await as("post", "/api/resumes")
      .field("name", "Engineering v2")
      .field("version", "2")
      .attach("resume", await pdfFixture(), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });
    expect(r.status).toBe(201);
    expect(r.body.fileUrl).toBe("");
    expect(r.body.version).toBe(2);
    const download = await as("get", `/api/resumes/${r.body.id}/download`);
    expect(download.status).toBe(200);
    expect(download.body.url).toContain("temporary-download");
    const result = await as("post", "/api/analyses").send({
      resumeId: r.body.id,
      jobDescription:
        "We need React, TypeScript and AWS experience for this role.",
      consent: false,
    });
    expect(result.status).toBe(201);
    expect(result.body.mode).toBe("demo");
    expect(
      result.body.result.supportedSkills.map((v: { skill: string }) => v.skill),
    ).toContain("React");
    expect(result.body.result.missingSkills).toContain("AWS");
    expect((await as("get", "/api/analyses", "bob")).body).toEqual([]);
    expect(
      (await as("delete", `/api/analyses/${result.body.id}`, "bob")).status,
    ).toBe(404);
    expect((await as("delete", `/api/resumes/${r.body.id}`)).status).toBe(204);
    expect(
      await prisma.analysis.count({ where: { resumeId: r.body.id } }),
    ).toBe(0);
  });
  it("reserves analysis quota safely under concurrent requests", async () => {
    await prisma.user.create({ data: { id: "quota-user" } });
    await prisma.resume.create({
      data: {
        id: "quota-resume",
        userId: "quota-user",
        name: "Quota",
        fileKey: "quota.pdf",
        fileUrl: "",
      },
    });
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        analyze(
          "quota-user",
          "quota-resume",
          "We need React and TypeScript to build accessible interfaces.",
        ),
      ),
    );
    expect(settled.filter((v) => v.status === "fulfilled")).toHaveLength(10);
    expect(
      await prisma.analysis.count({ where: { userId: "quota-user" } }),
    ).toBe(10);
  });
  it("validates real-provider output and requires consent without making paid calls", async () => {
    await prisma.user.create({ data: { id: "provider-user" } });
    await prisma.resume.create({
      data: {
        id: "provider-resume",
        userId: "provider-user",
        name: "Provider fixture",
        fileKey: "provider.pdf",
        fileUrl: "",
      },
    });
    process.env.AI_MODE = "openai-compatible";
    process.env.AI_API_KEY = "test-only-provider-key";
    const result = {
      supportedSkills: [
        {
          skill: "React",
          quote: "Built React applications with TypeScript and PostgreSQL.",
        },
      ],
      missingSkills: ["AWS"],
      improvements: [],
      preparationTopics: ["Discuss a React project you can substantiate."],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const denied = await as("post", "/api/analyses", "provider-user").send({
        resumeId: "provider-resume",
        jobDescription:
          "We need React and AWS engineers for our full stack product.",
        consent: false,
      });
      expect(denied.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
      const valid = await analyze(
        "provider-user",
        "provider-resume",
        "We need React and AWS engineers for our full stack product.",
      );
      expect(valid.result).toMatchObject({ heuristicScore: 50 });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).store).toBe(false);
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...result,
                  supportedSkills: [
                    { skill: "React", quote: "Invented experience" },
                  ],
                }),
              },
            },
          ],
        }),
      });
      await expect(
        analyze(
          "provider-user",
          "provider-resume",
          "We need React and AWS engineers for our full stack product.",
        ),
      ).rejects.toThrow("AI output failed evidence validation");
    } finally {
      vi.unstubAllGlobals();
      process.env.AI_MODE = "demo";
      delete process.env.AI_API_KEY;
    }
  });
  it("claims due reminders once under concurrent workers without sending email", async () => {
    await Promise.all([
      processReminderBatch(consoleProvider),
      processReminderBatch(consoleProvider),
    ]);
    const row = await prisma.reminder.findFirst({
      where: { applicationId: id, kind: "follow-up" },
    });
    expect(row?.status).toBe("previewed");
    expect(row?.attempts).toBe(1);
  });
  it("does not automatically retry an ambiguous delivery", async () => {
    const reminder = await prisma.reminder.create({
      data: {
        applicationId: id,
        kind: "follow-up",
        dueAt: new Date(0),
        dedupeKey: "ambiguous",
      },
    });
    const provider = {
      send: vi.fn().mockRejectedValue(new Error("Network timeout")),
    };
    await processReminderBatch(provider);
    await processReminderBatch(provider);
    expect(
      (await prisma.reminder.findUnique({ where: { id: reminder.id } }))
        ?.status,
    ).toBe("uncertain");
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it("cascades application-dependent activity and reminders on delete", async () => {
    expect((await as("delete", `/api/applications/${id}`)).status).toBe(204);
    expect(await prisma.activity.count({ where: { applicationId: id } })).toBe(
      0,
    );
    expect(await prisma.reminder.count({ where: { applicationId: id } })).toBe(
      0,
    );
  });
});

describe("dashboard follow-up action center", () => {
  it("includes the seven-day boundary, excludes terminal and other-user records, and ignores analytics dates", async () => {
    const now = new Date("2030-01-10T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      await prisma.user.createMany({
        data: [{ id: "follow-alice" }, { id: "follow-bob" }],
      });
      const rows = [
        { id: "overdue", followUpAt: new Date(now.getTime() - 1) },
        { id: "due-now", followUpAt: now },
        { id: "boundary", followUpAt: new Date(now.getTime() + 7 * 86400000) },
        {
          id: "too-late",
          followUpAt: new Date(now.getTime() + 7 * 86400000 + 1),
        },
        { id: "no-date", followUpAt: null },
        ...["Offer", "Reject", "Ghosted"].map((status) => ({
          id: status,
          status,
          followUpAt: now,
        })),
        { id: "other-user", userId: "follow-bob", followUpAt: now },
      ];
      await prisma.jobApplication.createMany({
        data: rows.map((row) => ({
          company: row.id,
          role: "Engineer",
          userId: "follow-alice",
          appliedDate: now,
          ...row,
        })),
      });
      const r = await as(
        "get",
        "/api/dashboard?from=2031-01-01",
        "follow-alice",
      );
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(0);
      expect(r.body.followUpCount).toBe(3);
      expect(r.body.followUps.map((v: { id: string }) => v.id)).toEqual([
        "overdue",
        "due-now",
        "boundary",
      ]);
      expect(Object.keys(r.body.followUps[0]).sort()).toEqual([
        "company",
        "followUpAt",
        "id",
        "role",
      ]);
      expect(
        (await as("get", "/api/dashboard", "follow-bob")).body.followUps.map(
          (v: { id: string }) => v.id,
        ),
      ).toEqual(["other-user"]);
      expect(
        (await as("get", "/api/dashboard", "no-follow-ups")).body.followUps,
      ).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("returns only the earliest ten while counting all matches and reflects cleared dates", async () => {
    await prisma.user.create({ data: { id: "follow-bounded" } });
    await prisma.jobApplication.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        id: `bounded-${i}`,
        userId: "follow-bounded",
        company: `Bounded ${i}`,
        role: "Engineer",
        followUpAt: new Date(Date.UTC(2000, 0, i + 1)),
      })),
    });
    const r = await as("get", "/api/dashboard", "follow-bounded");
    expect(r.body.followUps).toHaveLength(10);
    expect(r.body.followUpCount).toBe(12);
    expect(r.body.followUps.map((v: { id: string }) => v.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `bounded-${i}`),
    );
    expect(
      (
        await as("patch", "/api/applications/bounded-0", "follow-bounded").send(
          {
            followUpAt: null,
          },
        )
      ).status,
    ).toBe(200);
    const after = await as("get", "/api/dashboard", "follow-bounded");
    expect(after.body.followUpCount).toBe(11);
    expect(after.body.followUps[0].id).toBe("bounded-1");
  });
});
