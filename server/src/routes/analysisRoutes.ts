import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../config/prisma";
import { analyze, analysisInclude } from "../services/analysis";
import { detectRequirements } from "../services/resumeReview";
import { HttpError } from "../lib/errors";
const router = Router();
router.get("/config", (_req, res) =>
  res.json({ mode: "rules", dailyLimit: 10 }),
);
router.post("/requirements", (req, res) => {
  const { jobDescription } = z
    .object({ jobDescription: z.string().trim().min(50).max(20000) })
    .strict()
    .parse(req.body);
  res.json(detectRequirements(jobDescription));
});
router.get("/", async (req, res) =>
  res.json(
    await prisma.analysis.findMany({
      where: {
        userId: res.locals.userId,
        ...(req.query.applicationId
          ? { applicationId: z.string().min(1).parse(req.query.applicationId) }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: analysisInclude,
    }),
  ),
);
router.post(
  "/",
  rateLimit({
    windowMs: 60000,
    limit: 3,
    keyGenerator: (_req, res) => res.locals.userId,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  async (req, res) => {
    res.status(201).json(await analyze(res.locals.userId, req.body));
  },
);
router.get("/:id", async (req, res) => {
  const record = await prisma.analysis.findFirst({
    where: { id: String(req.params.id), userId: res.locals.userId },
    include: analysisInclude,
  });
  if (!record) throw new HttpError(404, "Analysis not found");
  res.json(record);
});
router.delete("/:id", async (req, res) => {
  const result = await prisma.analysis.deleteMany({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!result.count) throw new HttpError(404, "Analysis not found");
  res.status(204).end();
});
export default router;
