import { describe, it, expect, afterAll, vi } from "vitest";
import request from "supertest";
import prisma from "../src/config/prisma";
import { createApp } from "../src/app";
import { analyze } from "../src/services/analysis";
import { pdfFixture } from "./pdf-fixture";
vi.mock("../src/services/storage", () => ({
  readResume: vi.fn(),
  storeResume: vi.fn(),
  removeResume: vi.fn(),
  resumeDownloadUrl: vi.fn(),
}));
import { readResume } from "../src/services/storage";
const app = createApp({
  auth: (req, res, next) => {
    res.locals.userId = req.get("x-review-user") ?? "review-alice";
    next();
  },
});
const api = (
  method: "get" | "post" | "patch" | "delete",
  path: string,
  user = "review-alice",
) => request(app)[method](path).set("x-review-user", user);
const jd =
  "We need React, Node.js and AWS for this role. At least 3 years of professional experience is required.";
const text =
  "- Helped with React interfaces and NodeJS APIs\n- Built accessible forms and automated tests";
afterAll(() => prisma.$disconnect());
describe("resume review API", () => {
  it("saves a text review with an owned job, snapshots the job description, and never stores raw pasted text", async () => {
    if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
      throw Error("Use isolated tests");
    await prisma.user.createMany({
      data: [{ id: "review-alice" }, { id: "review-bob" }],
    });
    await prisma.jobApplication.create({
      data: {
        id: "review-job",
        userId: "review-alice",
        company: "Review Labs",
        role: "Engineer",
        jobDescription: jd,
      },
    });
    const r = await api("post", "/api/analyses").send({
      resumeText: text,
      jobDescription: jd,
      applicationId: "review-job",
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("completed");
    expect(r.body.resume).toBeNull();
    expect(r.body.application.company).toBe("Review Labs");
    expect(r.body.result.checks).toContainEqual(
      expect.objectContaining({ term: "Node.js", found: true }),
    );
    const stored = await prisma.analysis.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(stored).not.toHaveProperty("resumeText");
    expect(JSON.stringify(stored)).not.toContain(text);
    await api("patch", "/api/applications/review-job").send({
      jobDescription: "Changed description",
    });
    expect(
      (await api("get", `/api/analyses/${r.body.id}`)).body.jobDescription,
    ).toBe(jd);
    expect(
      (await api("get", "/api/analyses?applicationId=review-job")).body,
    ).toHaveLength(1);
    for (const method of ["get", "delete"] as const)
      expect(
        (await api(method, `/api/analyses/${r.body.id}`, "review-bob")).status,
      ).toBe(404);
    expect(
      (
        await api("post", "/api/analyses", "review-bob").send({
          resumeText: text,
          jobDescription: jd,
          applicationId: "review-job",
        })
      ).status,
    ).toBe(404);
    expect(
      (await api("get", "/api/analyses?applicationId=review-job", "review-bob"))
        .body,
    ).toEqual([]);
    await api("delete", "/api/applications/review-job");
    expect(
      (await api("get", `/api/analyses/${r.body.id}`)).body.applicationId,
    ).toBeNull();
  });
  it("previews owned PDF text without caching, reports extraction failures, and retains failed history outside the quota", async () => {
    await prisma.resume.create({
      data: {
        id: "review-pdf",
        userId: "review-alice",
        name: "PDF",
        fileKey: "private.pdf",
        fileUrl: "",
      },
    });
    vi.mocked(readResume).mockResolvedValue(await pdfFixture());
    expect(
      (await api("get", "/api/resumes/review-pdf/text", "review-bob")).status,
    ).toBe(404);
    const preview = await api("get", "/api/resumes/review-pdf/text");
    expect(preview.status).toBe(200);
    expect(preview.headers["cache-control"]).toBe("no-store");
    expect(preview.body.text).toContain("Built React");
    expect(preview.body.pages).toBe(1);
    vi.mocked(readResume).mockRejectedValue(
      new Error("private provider detail"),
    );
    const failed = await api("post", "/api/analyses").send({
      resumeId: "review-pdf",
      jobDescription: jd,
    });
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed.body)).not.toContain(
      "private provider detail",
    );
    expect(
      await prisma.analysis.count({
        where: { userId: "review-alice", status: "failed" },
      }),
    ).toBe(1);
    const r = await analyze("review-alice", {
      resumeText: text,
      jobDescription: jd,
    });
    expect(r.status).toBe("completed");
    vi.mocked(readResume).mockResolvedValue(await pdfFixture(""));
    const empty = await api("get", "/api/resumes/review-pdf/text");
    expect(empty.status).toBe(400);
    expect(empty.body.message).toContain("paste");
  });
  it("preserves failed history while allowing ten successful concurrent reservations", async () => {
    await prisma.user.create({ data: { id: "review-quota" } });
    await prisma.analysis.createMany({
      data: Array.from({ length: 12 }, () => ({
        userId: "review-quota",
        jobDescription: jd,
        mode: "rules",
        status: "failed",
      })),
    });
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        analyze("review-quota", {
          resumeText: text,
          jobDescription: jd,
          requirements: [],
        }),
      ),
    );
    expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(
      await prisma.analysis.count({
        where: { userId: "review-quota", status: "completed" },
      }),
    ).toBe(10);
    expect(
      await prisma.analysis.count({
        where: { userId: "review-quota", status: "failed" },
      }),
    ).toBe(12);
  });
  it("reclaims interrupted pending attempts without consuming the successful-review allowance", async () => {
    await prisma.user.create({ data: { id: "review-interrupted" } });
    const old = await prisma.analysis.create({
      data: {
        userId: "review-interrupted",
        jobDescription: jd,
        mode: "rules",
        status: "pending",
        createdAt: new Date(Date.now() - 6 * 60000),
      },
    });
    await analyze("review-interrupted", {
      resumeText: text,
      jobDescription: jd,
    });
    expect(
      (await prisma.analysis.findUniqueOrThrow({ where: { id: old.id } }))
        .status,
    ).toBe("failed");
  });
  it("rejects malformed or mixed inputs without creating records", async () => {
    const before = await prisma.analysis.count();
    expect(
      (
        await api("post", "/api/analyses", "invalid-user").send({
          resumeId: "review-pdf",
          resumeText: text,
          jobDescription: jd,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("post", "/api/analyses", "invalid-user").send({
          resumeText: text,
          jobDescription: jd,
          userId: "review-bob",
        })
      ).status,
    ).toBe(400);
    expect(await prisma.analysis.count()).toBe(before);
  });
});
