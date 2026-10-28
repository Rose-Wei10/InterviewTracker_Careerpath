import { z } from "zod";
import prisma from "../config/prisma";
import { HttpError } from "../lib/errors";
export const ghostWhere = (userId: string, now = new Date()) => ({
  userId,
  status: "Applied",
  appliedDate: { lte: new Date(now.getTime() - 30 * 86400000) },
});
export async function ghostReview(userId: string, input: unknown) {
  const { page } = z
    .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
    .parse(input);
  const where = ghostWhere(userId);
  const [items, total] = await prisma.$transaction([
    prisma.jobApplication.findMany({
      where,
      orderBy: [{ appliedDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * 10,
      take: 10,
      select: {
        id: true,
        company: true,
        role: true,
        appliedDate: true,
        status: true,
      },
    }),
    prisma.jobApplication.count({ where }),
  ]);
  return {
    items,
    total,
    page,
    pageSize: 10,
    totalPages: Math.ceil(total / 10),
  };
}
export async function markGhosted(userId: string, input: unknown) {
  const { ids } = z
    .object({ ids: z.array(z.string().min(1)).min(1).max(10) })
    .strict()
    .parse(input);
  const unique = [...new Set(ids)];
  return prisma.$transaction(async (tx) => {
    // Conditional updates recheck eligibility; stable ordering avoids competing batch deadlocks.
    const rows = await tx.jobApplication.findMany({
      where: { id: { in: unique }, userId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (rows.length !== unique.length)
      throw new HttpError(404, "Application not found");
    const updatedIds: string[] = [];
    for (const { id } of rows) {
      const changed = await tx.jobApplication.updateMany({
        where: { id, ...ghostWhere(userId) },
        data: { status: "Ghosted" },
      });
      if (changed.count) {
        updatedIds.push(id);
        await tx.activity.create({
          data: {
            applicationId: id,
            kind: "STATUS_CHANGED",
            metadata: {
              from: "Applied",
              to: "Ghosted",
              source: "30-day-review",
            },
          },
        });
      }
    }
    return {
      updatedIds,
      skippedIds: unique.filter((id) => !updatedIds.includes(id)),
    };
  });
}
