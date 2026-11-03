import { it, expect, afterAll } from "vitest";
import prisma from "../src/config/prisma";
import {
  migrateResume,
  type MigrationIO,
} from "../src/services/resumeMigration";
afterAll(() => prisma.$disconnect());
it("migration preserves relations and skips a concurrently changed reference in PostgreSQL", async () => {
  if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
    throw Error("Use isolated tests");
  await prisma.user.create({ data: { id: "migration-user" } });
  const record = await prisma.resume.create({
    data: {
      id: "migration-resume",
      userId: "migration-user",
      name: "Fixture",
      fileKey: "legacy.pdf",
      fileUrl: "old-url",
    },
  });
  await prisma.jobApplication.create({
    data: {
      id: "migration-job",
      company: "Fixture",
      role: "Engineer",
      userId: record.userId,
      resumeId: record.id,
    },
  });
  await prisma.analysis.create({
    data: {
      id: "migration-report",
      userId: record.userId,
      resumeId: record.id,
      jobDescription: "Snapshot",
      mode: "rules",
    },
  });
  let target: Uint8Array | null = null;
  const io: MigrationIO = {
    readSource: async () => Buffer.from("%PDF-fixture"),
    readTarget: async () => target,
    copy: async (_key, bytes) => {
      target = bytes;
    },
    replace: async (r, key) =>
      (
        await prisma.resume.updateMany({
          where: {
            id: r.id,
            userId: r.userId,
            fileKey: r.fileKey,
            fileUrl: r.fileUrl,
          },
          data: { fileKey: key, fileUrl: "" },
        })
      ).count === 1,
    journal: async () => {},
  };
  await prisma.resume.update({
    where: { id: record.id },
    data: { fileKey: "concurrent.pdf" },
  });
  expect((await migrateResume(record, io, true)).status).toBe("conflict");
  expect(
    (await prisma.resume.findUniqueOrThrow({ where: { id: record.id } }))
      .fileKey,
  ).toBe("concurrent.pdf");
  target = null;
  const current = await prisma.resume.findUniqueOrThrow({
    where: { id: record.id },
  });
  expect((await migrateResume(current, io, true)).status).toBe("migrated");
  const saved = await prisma.resume.findUniqueOrThrow({
    where: { id: record.id },
    include: { applications: true, analyses: true },
  });
  expect(saved.fileKey).toMatch(/^vercel-blob:/);
  expect(saved.applications[0].id).toBe("migration-job");
  expect(saved.analyses[0].jobDescription).toBe("Snapshot");
  expect(saved.createdAt).toEqual(record.createdAt);
  expect((await migrateResume(saved, io, true)).status).toBe("already-blob");
});
