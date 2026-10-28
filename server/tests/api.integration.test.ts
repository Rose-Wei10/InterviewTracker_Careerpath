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
import { processReminderBatch } from "../src/jobs/reminders";
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
  it("keeps interview adapters with dashboard reminders and no delivery jobs", async () => {
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
    ).toBe(0);
    expect(r.body.reminderMinutes).toBe(60);
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
    expect(result.body.mode).toBe("rules");
    expect(
      result.body.result.checks
        .filter((v: { found: boolean }) => v.found)
        .map((v: { term: string }) => v.term),
    ).toContain("React");
    expect(result.body.result.checks).toContainEqual(
      expect.objectContaining({ term: "AWS", found: false }),
    );
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
        analyze("quota-user", {
          resumeText: "Built React interfaces with TypeScript and PostgreSQL.",
          jobDescription:
            "We need React and TypeScript to build accessible interfaces.",
        }),
      ),
    );
    expect(settled.filter((v) => v.status === "fulfilled")).toHaveLength(10);
    expect(
      await prisma.analysis.count({ where: { userId: "quota-user" } }),
    ).toBe(10);
  });
  it("never calls an AI provider, even when legacy provider settings are enabled", async () => {
    vi.stubEnv("AI_MODE", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "test-only");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const r = await analyze("alice", {
        resumeText: "Built React applications with TypeScript and PostgreSQL.",
        jobDescription:
          "We need React and AWS engineers for our full stack product.",
      });
      expect(r.mode).toBe("rules");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it("never creates or delivers follow-up jobs", async () => {
    expect(
      await prisma.reminder.count({
        where: { applicationId: id, kind: "follow-up" },
      }),
    ).toBe(0);
    const legacy = await prisma.reminder.create({
      data: {
        applicationId: id,
        kind: "follow-up",
        dueAt: new Date(0),
        dedupeKey: "legacy-follow",
      },
    });
    const provider = { send: vi.fn() };
    await processReminderBatch(provider);
    expect(provider.send).not.toHaveBeenCalled();
    expect(
      (await prisma.reminder.findUniqueOrThrow({ where: { id: legacy.id } }))
        .attempts,
    ).toBe(0);
  });
  it("does not automatically retry an ambiguous delivery", async () => {
    const reminder = await prisma.reminder.create({
      data: {
        applicationId: id,
        kind: "interview",
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
