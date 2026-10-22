import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../config/prisma";
import { analyze } from "../services/analysis";
import { HttpError } from "../lib/errors";
const router = Router();
router.get("/config", (_req, res) =>
  res.json({
    mode: process.env.AI_MODE ?? "demo",
    dailyLimit: 10,
    providerOrigin: new URL(
      process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    ).origin,
    model: process.env.AI_MODEL ?? "gpt-4.1-mini",
  }),
);
router.get("/", async (_req, res) =>
  res.json(
    await prisma.analysis.findMany({
      where: { userId: res.locals.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { resume: { select: { name: true } } },
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
    const data = z
      .object({
        resumeId: z.string().min(1),
        jobDescription: z.string().trim().min(50).max(20000),
        consent: z.boolean(),
      })
      .strict()
      .parse(req.body);
    if ((process.env.AI_MODE ?? "demo") !== "demo" && !data.consent)
      throw new HttpError(
        400,
        "Consent is required before sharing resume text with the configured AI provider",
      );
    res
      .status(201)
      .json(
        await analyze(res.locals.userId, data.resumeId, data.jobDescription),
      );
  },
);
router.delete("/:id", async (req, res) => {
  const result = await prisma.analysis.deleteMany({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!result.count) throw new HttpError(404, "Analysis not found");
  res.status(204).end();
});
export default router;
