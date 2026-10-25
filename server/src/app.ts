import "dotenv/config";
import { validateEnv } from "./config/env";
import express from "express";
import type { RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import applicationRoutes from "./routes/applicationRoutes";
import dashboardRoutes from "./routes/dashboard";
import resumeRoutes from "./routes/resumeRoutes";
import analysisRoutes from "./routes/analysisRoutes";
import { requireUser } from "./middleware/auth";
import { errorHandler } from "./lib/errors";
import prisma from "./config/prisma";
export function createApp(
  options: { auth?: RequestHandler; origin?: string } = {},
) {
  if (options.auth && process.env.NODE_ENV !== "test")
    throw new Error("Injected auth is only allowed in tests");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin:
        options.origin ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests; try again shortly" },
    }),
  );
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  });
  if (options.auth) app.use("/api", options.auth);
  else
    app.use(
      "/api",
      clerkMiddleware({
        authorizedParties: [
          process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
        ],
      }),
      requireUser,
    );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api/applications", applicationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/resumes", resumeRoutes);
  app.use("/api/analyses", analysisRoutes);
  app.get("/api/interviews", async (_req, res) =>
    res.json(
      await prisma.interview.findMany({
        where: { application: { userId: res.locals.userId } },
        orderBy: { startsAt: "asc" },
        take: 500,
        include: {
          application: { select: { id: true, company: true, role: true } },
        },
      }),
    ),
  );
  app.get("/api/reminders", async (_req, res) =>
    res.json(
      await prisma.reminder.findMany({
        where: { application: { userId: res.locals.userId } },
        orderBy: { dueAt: "desc" },
        take: 100,
        select: {
          id: true,
          kind: true,
          dueAt: true,
          status: true,
          attempts: true,
        },
      }),
    ),
  );
  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });
  app.use(errorHandler);
  return app;
}

if (process.env.VERCEL) validateEnv();
export default createApp();
