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
import { ghostReview, markGhosted } from "../services/ghostReview";
import { saveEvent } from "../services/events";
import { parse } from "csv-parse/sync";
const router = Router();
router.get("/", async (req, res) => {
  res.json(await listApplications(res.locals.userId, req.query));
});
router.get("/ghost-review", async (req, res) =>
  res.json(await ghostReview(res.locals.userId, req.query)),
);
router.post("/ghost-review", async (req, res) =>
  res.json(await markGhosted(res.locals.userId, req.body)),
);
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
    for (const { followUpAt: _legacyFollowUp, ...row } of data) {
      void _legacyFollowUp;
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
  const id = String(req.params.id),
    userId = String(res.locals.userId);
  await ownApplication(userId, id);
  const application = await prisma.jobApplication.findFirstOrThrow({
    where: { id, userId },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 200 },
      interviews: {
        where: { category: "Interview" },
        orderBy: { startsAt: "asc" },
      },
      resume: { select: { id: true, name: true } },
    },
  });
  const events = await prisma.interview.findMany({
    where: { applicationId: id, userId },
    orderBy: { startsAt: "asc" },
    include: {
      application: { select: { id: true, company: true, role: true } },
    },
  });
  res.json({ ...application, events });
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
  res
    .status(201)
    .json(
      await saveEvent(res.locals.userId, {
        ...data,
        startsAt: data.startsAt.toISOString(),
        category: "Interview",
        applicationId: id,
      }),
    );
});
router.patch("/:id/interviews/:interviewId", async (req, res) => {
  const data = interviewUpdateSchema.parse(req.body),
    id = String(req.params.id);
  await ownApplication(res.locals.userId, id);
  const event = await prisma.interview.findFirst({
    where: {
      id: String(req.params.interviewId),
      applicationId: id,
      userId: res.locals.userId,
      category: "Interview",
    },
  });
  if (!event) throw new HttpError(404, "Event not found");
  res.json(await saveEvent(res.locals.userId, data, event.id));
});
export default router;
