import { Prisma, type Interview } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import prisma from "../config/prisma";
import {
  eventListSchema,
  eventSchema,
  eventUpdateSchema,
} from "../lib/validation";
import { HttpError } from "../lib/errors";

export const eventApplication = {
  application: { select: { id: true, company: true, role: true } },
};
export function eventDeadline(
  event: Pick<Interview, "startsAt" | "timeZone" | "allDay">,
) {
  if (!event.allDay) return event.startsAt;
  const date = formatInTimeZone(event.startsAt, event.timeZone, "yyyy-MM-dd");
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return fromZonedTime(
    `${next.toISOString().slice(0, 10)}T00:00:00`,
    event.timeZone,
  );
}
export function eventAttention(event: Interview, now: Date) {
  const overdue = eventDeadline(event).getTime() <= now.getTime();
  const reminderAt =
    event.reminderMinutes == null
      ? null
      : new Date(event.startsAt.getTime() - event.reminderMinutes * 60000);
  return {
    ...event,
    overdue,
    reminderAt,
    needsAttention:
      event.status === "Scheduled" &&
      (overdue || (reminderAt != null && reminderAt <= now)),
  };
}
export async function listEvents(userId: string, input: unknown) {
  const q = eventListSchema.parse(input);
  const where: Prisma.InterviewWhereInput = {
    userId,
    startsAt: { gte: q.from, lte: q.to },
    ...(q.applicationId ? { applicationId: q.applicationId } : {}),
    ...(q.category ? { category: q.category } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.interview.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: eventApplication,
    }),
    prisma.interview.count({ where }),
  ]);
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(total / q.pageSize),
  };
}
export async function saveEvent(userId: string, input: unknown, id?: string) {
  const patch = id ? eventUpdateSchema.parse(input) : eventSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    let before: Interview | null = null;
    if (id) {
      const owned = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Interview" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
      if (!owned.length) throw new HttpError(404, "Event not found");
      before = await tx.interview.findUnique({ where: { id } });
    }
    const {
      id: _id,
      userId: _user,
      createdAt: _created,
      ...previous
    } = before ?? {};
    void _id;
    void _user;
    void _created;
    const { updateApplicationStatus, ...data } = eventSchema.parse({
      ...previous,
      ...(before ? { startsAt: before.startsAt.toISOString() } : {}),
      ...patch,
      startsAt: patch.startsAt?.toISOString() ?? before?.startsAt.toISOString(),
    });
    if (data.applicationId) {
      const owned = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "JobApplication" WHERE id=${data.applicationId} AND "userId"=${userId} FOR UPDATE`;
      if (!owned.length) throw new HttpError(404, "Application not found");
    }
    if (
      updateApplicationStatus &&
      (!data.applicationId || data.category === "Other")
    )
      throw new HttpError(
        400,
        "Choose a linked OA or interview event to update application status",
      );
    if (data.allDay)
      data.startsAt = fromZonedTime(
        `${formatInTimeZone(data.startsAt, data.timeZone, "yyyy-MM-dd")}T09:00:00`,
        data.timeZone,
      );
    await tx.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    });
    const event = id
      ? await tx.interview.update({
          where: { id, userId },
          data: { ...data, applicationId: data.applicationId ?? null },
          include: eventApplication,
        })
      : await tx.interview.create({
          data: { ...data, userId },
          include: eventApplication,
        });
    if (event.applicationId)
      await tx.activity.create({
        data: {
          applicationId: event.applicationId,
          kind: id ? "EVENT_UPDATED" : "EVENT_SCHEDULED",
          metadata: {
            eventId: event.id,
            category: event.category,
            title: event.title,
            startsAt: event.startsAt.toISOString(),
            status: event.status,
          },
        },
      });
    if (updateApplicationStatus && event.applicationId) {
      const application = await tx.jobApplication.findUniqueOrThrow({
        where: { id: event.applicationId, userId },
      });
      const status = event.category === "OA" ? "OA" : "Interview";
      if (application.status !== status) {
        await tx.jobApplication.update({
          where: { id: application.id, userId },
          data: { status },
        });
        await tx.activity.create({
          data: {
            applicationId: application.id,
            kind: "STATUS_CHANGED",
            metadata: { from: application.status, to: status },
          },
        });
      }
    }
    // Legacy queued email is not used by dashboard reminders, including rescheduled events.
    if (id)
      await tx.reminder.updateMany({
        where: {
          interviewId: id,
          status: { in: ["pending", "failed", "uncertain"] },
        },
        data: { status: "cancelled", lockedUntil: null },
      });
    return event;
  });
}

const deadlineSql = Prisma.sql`CASE WHEN i."allDay" THEN (((((i."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE i."timeZone")::date + 1)::timestamp) AT TIME ZONE i."timeZone") ELSE i."startsAt" AT TIME ZONE 'UTC' END`;
const attentionSql = (now: Date) =>
  Prisma.sql`(${deadlineSql}) <= ${now}::timestamptz OR (i."reminderMinutes" IS NOT NULL AND (i."startsAt" AT TIME ZONE 'UTC') - i."reminderMinutes" * INTERVAL '1 minute' <= ${now}::timestamptz)`;
async function eventPanel(
  userId: string,
  condition: Prisma.Sql,
  now: Date,
  page = 1,
) {
  const rows = await prisma.$queryRaw<
    (Interview & {
      application: { id: string; company: string; role: string } | null;
      total: bigint;
    })[]
  >(Prisma.sql`
    SELECT i.*, CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('id',a.id,'company',a.company,'role',a.role) END AS application, COUNT(*) OVER() AS total
    FROM "Interview" i LEFT JOIN "JobApplication" a ON a.id=i."applicationId"
    WHERE i."userId"=${userId} AND i.status='Scheduled' AND (${condition})
    ORDER BY i."startsAt",i.id LIMIT 10 OFFSET ${(page - 1) * 10}`);
  const total = rows[0]
    ? Number(rows[0].total)
    : page > 1
      ? Number(
          (
            await prisma.$queryRaw<{ total: bigint }[]>(
              Prisma.sql`SELECT COUNT(*) AS total FROM "Interview" i WHERE i."userId"=${userId} AND i.status='Scheduled' AND (${condition})`,
            )
          )[0].total,
        )
      : 0;
  return {
    items: rows.map(({ total: _total, ...event }) => {
      void _total;
      return eventAttention(event, now);
    }),
    total,
    page,
    pageSize: 10,
    totalPages: Math.ceil(total / 10),
  };
}
export async function attentionEvents(
  userId: string,
  page = 1,
  now = new Date(),
) {
  return eventPanel(userId, attentionSql(now), now, page);
}
export async function eventPanels(userId: string, now = new Date()) {
  const [upcoming, attention] = await Promise.all([
    eventPanel(
      userId,
      Prisma.sql`(${deadlineSql}) > ${now}::timestamptz AND (i."startsAt" AT TIME ZONE 'UTC') <= ${new Date(now.getTime() + 7 * 86400000)}::timestamptz`,
      now,
    ),
    attentionEvents(userId, 1, now),
  ]);
  return {
    upcoming: upcoming.items,
    upcomingCount: upcoming.total,
    attention: attention.items,
    attentionCount: attention.total,
  };
}
