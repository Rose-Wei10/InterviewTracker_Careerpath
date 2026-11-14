import { test, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import prisma from "../src/config/prisma";
import {
  createApplication,
  updateApplication,
} from "../src/services/applications";
afterAll(() => prisma.$disconnect());
test("submission evidence is transactional, owner scoped and deduplicated without status changes", async () => {
  if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
    throw Error("Disposable test database required");
  const owner = `receipt-${randomUUID()}`,
    other = `receipt-${randomUUID()}`;
  const input = {
    company: "Synthetic receipt test",
    role: "Engineer",
    appliedDate: "2026-11-13",
    status: "OA",
  };
  const evidence = {
    confirmed: true,
    excerpt: "Application received.",
    confirmedAt: "2026-11-13T12:00:00Z",
    sourceUrl: "https://employer.test/receipt",
  };
  try {
    const record = await createApplication(owner, {
      ...input,
      submissionEvidence: evidence,
    });
    await Promise.all(
      [1, 2].map(() =>
        updateApplication(owner, record.id, { submissionEvidence: evidence }),
      ),
    );
    expect(
      await prisma.activity.count({
        where: { applicationId: record.id, kind: "SUBMISSION_CONFIRMED" },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.jobApplication.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).status,
    ).toBe("OA");
    await prisma.user.create({ data: { id: other } });
    const email = await prisma.emailUpdate.create({
      data: {
        userId: other,
        account: "synthetic@example.test",
        messageId: randomUUID(),
        threadId: "thread",
        sender: "recruiter@example.test",
        subject: "Received",
        receivedAt: new Date(),
        category: "Application received",
      },
    });
    await expect(
      updateApplication(owner, record.id, {
        notes: "Must roll back",
        submissionEvidence: { ...evidence, emailUpdateId: email.id },
      }),
    ).rejects.toThrow("Email evidence not found");
    expect(
      (
        await prisma.jobApplication.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).notes,
    ).not.toBe("Must roll back");
    await expect(
      updateApplication(other, record.id, { submissionEvidence: evidence }),
    ).rejects.toThrow("Application not found");
    await expect(
      createApplication(owner, {
        ...input,
        submissionEvidence: { ...evidence, confirmed: false },
      }),
    ).rejects.toThrow();
  } finally {
    await prisma.jobApplication.deleteMany({
      where: { userId: { in: [owner, other] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
  }
});
