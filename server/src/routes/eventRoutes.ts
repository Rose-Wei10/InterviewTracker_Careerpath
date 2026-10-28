import { z } from "zod";
import { Router } from "express";
import prisma from "../config/prisma";
import { HttpError } from "../lib/errors";
import {
  attentionEvents,
  eventApplication,
  listEvents,
  saveEvent,
} from "../services/events";
const router = Router();
router.get("/", async (req, res) =>
  res.json(await listEvents(res.locals.userId, req.query)),
);
router.post("/", async (req, res) =>
  res.status(201).json(await saveEvent(res.locals.userId, req.body)),
);
router.get("/attention", async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1)
    .parse(req.query.page);
  res.json(await attentionEvents(res.locals.userId, page));
});
router.get("/:id", async (req, res) => {
  const event = await prisma.interview.findFirst({
    where: { id: String(req.params.id), userId: res.locals.userId },
    include: eventApplication,
  });
  if (!event) throw new HttpError(404, "Event not found");
  res.json(event);
});
router.patch("/:id", async (req, res) =>
  res.json(await saveEvent(res.locals.userId, req.body, String(req.params.id))),
);
export default router;
