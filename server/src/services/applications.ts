import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { applicationSchema, listSchema, updateSchema } from "../lib/validation";
import { HttpError } from "../lib/errors";
import { z } from "zod";
export function applicationWhere(
  userId: string,
  q: z.infer<typeof listSchema>,
): Prisma.JobApplicationWhereInput {
  return {
    userId,
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
export async function createApplication(userId: string, input: unknown) {
  const data = applicationSchema.parse(input);
  await checkResume(userId, data.resumeId);
  return prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    return tx.jobApplication.create({
      data: {
        ...data,
        userId,
        activities: {
          create: {
            kind: "APPLICATION_CREATED",
            metadata: { status: data.status },
          },
        },
        ...(data.followUpAt
          ? {
              reminders: {
                create: {
                  dedupeKey: crypto.randomUUID(),
                  kind: "follow-up",
                  dueAt: data.followUpAt,
                },
              },
            }
          : {}),
      },
    });
  });
}
export async function updateApplication(
  userId: string,
  id: string,
  input: unknown,
) {
  const data = updateSchema.parse(input);
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
    if (data.followUpAt !== undefined) {
      await tx.reminder.deleteMany({
        where: {
          applicationId: id,
          kind: "follow-up",
          status: { not: "sent" },
        },
      });
      if (data.followUpAt)
        await tx.reminder.create({
          data: {
            applicationId: id,
            kind: "follow-up",
            dedupeKey: crypto.randomUUID(),
            dueAt: data.followUpAt,
          },
        });
    }
    return record;
  });
}
