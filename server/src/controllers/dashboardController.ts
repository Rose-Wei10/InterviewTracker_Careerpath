import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { listSchema, statuses } from "../lib/validation";
import { applicationWhere } from "../services/applications";
export async function getDashboardStats(req: Request, res: Response) {
  const q = listSchema.parse(req.query),
    where = applicationWhere(res.locals.userId, q);
  const userId = String(res.locals.userId);
  const [groups, recent, upcoming, trends, monthly] = await Promise.all([
    prisma.jobApplication.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.activity.findMany({
      where: { application: where },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { application: { select: { company: true, role: true } } },
    }),
    prisma.interview.findMany({
      where: {
        application: { userId },
        status: "Scheduled",
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
      include: {
        application: { select: { id: true, company: true, role: true } },
      },
    }),
    prisma.$queryRaw<Array<{ week: Date; count: bigint }>>(Prisma.sql`
      SELECT date_trunc('week', "appliedDate") AS week, COUNT(*) AS count FROM "JobApplication"
      WHERE "userId" = ${userId} AND (${q.from ?? null}::timestamp IS NULL OR "appliedDate" >= ${q.from ?? null}::timestamp) AND (${q.to ?? null}::timestamp IS NULL OR "appliedDate" <= ${q.to ?? null}::timestamp)
      GROUP BY week ORDER BY week`),
    prisma.$queryRaw<Array<{ month: Date; count: bigint }>>(
      Prisma.sql`SELECT date_trunc('month', "appliedDate") AS month, COUNT(*) AS count FROM "JobApplication" WHERE "userId" = ${userId} AND (${q.from ?? null}::timestamp IS NULL OR "appliedDate" >= ${q.from ?? null}::timestamp) AND (${q.to ?? null}::timestamp IS NULL OR "appliedDate" <= ${q.to ?? null}::timestamp) GROUP BY month ORDER BY month`,
    ),
  ]);
  const counts = Object.fromEntries(
    statuses.map((s) => [
      s,
      groups.find((g) => g.status === s)?._count._all ?? 0,
    ]),
  );
  const total = groups.reduce((n, g) => n + g._count._all, 0);
  const responded = [
    "OA",
    "Interview",
    "Final Round",
    "Offer",
    "Reject",
  ].reduce((n, s) => n + counts[s], 0);
  const interviews = ["Interview", "Final Round", "Offer"].reduce(
    (n, s) => n + counts[s],
    0,
  );
  // Current status proxies: rejected records may have interviewed; no invented historical conversion.
  res.json({
    total,
    counts,
    responseRate: total ? responded / total : 0,
    interviewRate: total ? interviews / total : 0,
    rateLabel:
      "Current-status proxies; historical transitions before tracking are unknown",
    recent,
    upcoming,
    weekly: trends.map((t) => ({
      date: t.week.toISOString().slice(0, 10),
      count: Number(t.count),
    })),
    monthly: monthly.map((t) => ({
      date: t.month.toISOString().slice(0, 7),
      count: Number(t.count),
    })),
  });
}
