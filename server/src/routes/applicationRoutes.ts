import { Router } from "express";
import prisma from "../config/prisma";
import {
  createApplication,
  listApplications,
  ownApplication,
  updateApplication,
  applicationWhere,
} from "../services/applications";
import {
  applicationSchema,
  interviewSchema,
  interviewUpdateSchema,
  listSchema,
} from "../lib/validation";
import { HttpError } from "../lib/errors";
import { z } from "zod";
import { parse } from "csv-parse/sync";
const router = Router();
router.get("/", async (req, res) => {
  res.json(await listApplications(res.locals.userId, req.query));
});
const csvFields = [
  "company",
  "role",
  "status",
  "appliedDate",
  "location",
  "salary",
  "jobLink",
  "notes",
] as const;
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
router.get("/export", async (req, res) => {
  const q = listSchema.parse(req.query);
  const rows = await prisma.jobApplication.findMany({
    where: applicationWhere(res.locals.userId, q),
    orderBy: { appliedDate: "desc" },
    take: 10001,
  });
  if (rows.length > 10000)
    throw new HttpError(
      400,
      "Export limit is 10,000 rows. Narrow your date filter.",
    );
  res
    .type("text/csv")
    .attachment("applications.csv")
    .send(
      [
        csvFields.join(","),
        ...rows.map((r) =>
          csvFields
            .map((k) =>
              csvCell(
                r[k] instanceof Date ? (r[k] as Date).toISOString() : r[k],
              ),
            )
            .join(","),
        ),
      ].join("\r\n"),
    );
});
router.post("/import", async (req, res) => {
  const { csv } = z
    .object({ csv: z.string().min(1).max(1000000) })
    .strict()
    .parse(req.body);
  let rows: unknown[];
  try {
    rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      max_record_size: 50000,
    });
  } catch {
    throw new HttpError(400, "Invalid CSV");
  }
  const data = z.array(applicationSchema).min(1).max(500).parse(rows);
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: res.locals.userId },
      create: { id: res.locals.userId },
      update: {},
    });
    for (const row of data) {
      if (row.resumeId)
        throw new HttpError(400, "CSV import does not accept resume IDs");
      await tx.jobApplication.create({
        data: {
          ...row,
          userId: res.locals.userId,
          activities: {
            create: {
              kind: "APPLICATION_CREATED",
              metadata: { source: "csv" },
            },
          },
          ...(row.followUpAt
            ? {
                reminders: {
                  create: {
                    kind: "follow-up",
                    dueAt: row.followUpAt,
                    dedupeKey: crypto.randomUUID(),
                  },
                },
              }
            : {}),
        },
      });
    }
  });
  res.status(201).json({ imported: data.length });
});
router.post("/", async (req, res) => {
  res.status(201).json(await createApplication(res.locals.userId, req.body));
});
router.get("/:id", async (req, res) => {
  await ownApplication(res.locals.userId, String(req.params.id));
  res.json(
    await prisma.jobApplication.findFirst({
      where: { id: String(req.params.id), userId: res.locals.userId },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 200 },
        interviews: { orderBy: { startsAt: "asc" } },
        resume: { select: { id: true, name: true } },
      },
    }),
  );
});
router.put("/:id", async (req, res) => {
  res.json(
    await updateApplication(res.locals.userId, String(req.params.id), req.body),
  );
});
router.patch("/:id", async (req, res) => {
  res.json(
    await updateApplication(res.locals.userId, String(req.params.id), req.body),
  );
});
router.delete("/:id", async (req, res) => {
  const result = await prisma.jobApplication.deleteMany({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!result.count) throw new HttpError(404, "Application not found");
  res.status(204).end();
});
router.post("/:id/interviews", async (req, res) => {
  const data = interviewSchema.parse(req.body);
  const id = String(req.params.id);
  await ownApplication(res.locals.userId, id);
  const { reminderMinutes, ...fields } = data;
  const interview = await prisma.$transaction(async (tx) => {
    const record = await tx.interview.create({
      data: { ...fields, applicationId: id },
    });
    await tx.activity.create({
      data: {
        applicationId: id,
        kind: "INTERVIEW_SCHEDULED",
        metadata: {
          interviewId: record.id,
          startsAt: record.startsAt.toISOString(),
        },
      },
    });
    if (reminderMinutes != null)
      await tx.reminder.create({
        data: {
          applicationId: id,
          interviewId: record.id,
          kind: "interview",
          dedupeKey: `interview:${record.id}`,
          dueAt: new Date(record.startsAt.getTime() - reminderMinutes * 60000),
        },
      });
    return record;
  });
  res.status(201).json(interview);
});
router.patch("/:id/interviews/:interviewId", async (req, res) => {
  const data = interviewUpdateSchema.parse(req.body),
    id = String(req.params.id);
  await ownApplication(res.locals.userId, id);
  res.json(
    await prisma.$transaction(async (tx) => {
      const record = await tx.interview.update({
        where: { id: String(req.params.interviewId), applicationId: id },
        data,
      });
      if (data.status !== "Scheduled")
        await tx.reminder.deleteMany({
          where: { interviewId: record.id, status: { not: "sent" } },
        });
      await tx.activity.create({
        data: {
          applicationId: id,
          kind:
            data.status === "Completed"
              ? "INTERVIEW_COMPLETED"
              : "INTERVIEW_UPDATED",
          metadata: { status: data.status },
        },
      });
      return record;
    }),
  );
});
export default router;
