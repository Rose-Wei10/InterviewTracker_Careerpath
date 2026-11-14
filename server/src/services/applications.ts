import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import {
  applicationWithEvidenceSchema,
  submissionEvidenceSchema,
  listSchema,
  updateSchema,
} from "../lib/validation";
import { HttpError } from "../lib/errors";
import { z } from "zod";
export function applicationWhere(
  userId: string,
  q: z.infer<typeof listSchema>,
): Prisma.JobApplicationWhereInput {
  return {
    userId,
    ...(q.jobLink ? { jobLink: q.jobLink } : {}),
    ...(q.search
      ? {
          OR: [
            { company: { contains: q.search, mode: "insensitive" } },
            { role: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.location
      ? { location: { contains: q.location, mode: "insensitive" } }
      : {}),
    ...(q.from || q.to ? { appliedDate: { gte: q.from, lte: q.to } } : {}),
  };
}
export async function ownApplication(userId: string, id: string) {
  const record = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!record) throw new HttpError(404, "Application not found");
  return record;
}
async function checkResume(userId: string, resumeId?: string | null) {
  if (
    resumeId &&
    !(await prisma.resume.findFirst({
      where: { id: resumeId, userId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Resume not found");
}
export async function listApplications(userId: string, input: unknown) {
  const q = listSchema.parse(input),
    where = applicationWhere(userId, q);
  const [items, total] = await prisma.$transaction([
    prisma.jobApplication.findMany({
      where,
      orderBy: [{ [q.sort]: q.direction }, { id: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.jobApplication.count({ where }),
  ]);
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(total / q.pageSize),
  };
}
async function saveEvidence(
  tx: Prisma.TransactionClient,
  userId: string,
  applicationId: string,
  evidence?: z.infer<typeof submissionEvidenceSchema>,
) {
  if (!evidence) return;
  if (
    evidence.emailUpdateId &&
    !(await tx.emailUpdate.findFirst({
      where: { id: evidence.emailUpdateId, userId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Email evidence not found");
  const evidenceId = createHash("sha256")
    .update(
      JSON.stringify([
        evidence.sourceUrl || "",
        evidence.emailUpdateId || "",
        evidence.excerpt,
      ]),
    )
    .digest("hex");
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "JobApplication" WHERE id=${applicationId} AND "userId"=${userId} FOR UPDATE`,
  );
  const existing = await tx.activity.findFirst({
    where: {
      applicationId,
      kind: "SUBMISSION_CONFIRMED",
      metadata: { path: ["evidenceId"], equals: evidenceId },
    },
    select: { id: true },
  });
  if (!existing)
    await tx.activity.create({
      data: {
        applicationId,
        kind: "SUBMISSION_CONFIRMED",
        metadata: { ...evidence, evidenceId },
      },
    });
}
export async function createApplication(userId: string, input: unknown) {
  const {
    followUpAt: _legacyFollowUp,
    submissionEvidence,
    ...data
  } = applicationWithEvidenceSchema.parse(input);
  void _legacyFollowUp;
  await checkResume(userId, data.resumeId);
  return prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    const record = await tx.jobApplication.create({
      data: {
        ...data,
        userId,
        activities: {
          create: {
            kind: "APPLICATION_CREATED",
            metadata: { status: data.status },
          },
        },
      },
    });
    await saveEvidence(tx, userId, record.id, submissionEvidence);
    return record;
  });
}
export async function updateApplication(
  userId: string,
  id: string,
  input: unknown,
) {
  const {
    followUpAt: _legacyFollowUp,
    submissionEvidence,
    ...data
  } = updateSchema.parse(input);
  void _legacyFollowUp;
  await checkResume(userId, data.resumeId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.jobApplication.findFirst({ where: { id, userId } });
    if (!before) throw new HttpError(404, "Application not found");
    const record = await tx.jobApplication.update({
      where: { id, userId },
      data,
    });
    if (data.status && before.status !== data.status)
      await tx.activity.create({
        data: {
          applicationId: id,
          kind:
            data.status === "Offer"
              ? "OFFER_RECEIVED"
              : data.status === "Reject"
                ? "APPLICATION_REJECTED"
                : "STATUS_CHANGED",
          metadata: { from: before.status, to: data.status },
        },
      });
    if (data.notes !== undefined && before.notes !== data.notes)
      await tx.activity.create({
        data: { applicationId: id, kind: "NOTES_UPDATED" },
      });
    await saveEvidence(tx, userId, record.id, submissionEvidence);
    return record;
  });
}
