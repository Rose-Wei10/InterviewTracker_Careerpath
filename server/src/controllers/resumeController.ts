import type { Request, Response } from "express";
import {
  storeResume,
  removeResume,
  resumeDownloadUrl,
} from "../services/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import prisma from "../config/prisma";
import { HttpError } from "../lib/errors";
const metadata = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    version: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export async function createResume(req: Request, res: Response) {
  const data = metadata.parse(req.body),
    file = req.file;
  if (!file || file.buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new HttpError(400, "A valid PDF is required");
  const userId = String(res.locals.userId),
    key = await storeResume(
      `resumes/${userId}/${randomUUID()}.pdf`,
      file.buffer,
    );
  try {
    const resume = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });
      return tx.resume.create({
        data: {
          ...data,
          userId,
          fileKey: key,
          fileUrl: "",
          size: file.size,
          originalName: file.originalname.slice(0, 255),
        },
      });
    });
    res.status(201).json(resume);
  } catch (error) {
    // Compensate for DB failures; a lifecycle audit can detect the rare failed compensation.
    await removeResume(key).catch(() =>
      console.error(
        "Resume compensation failed; storage reconciliation required",
      ),
    );
    throw error;
  }
}
export async function getResumes(_req: Request, res: Response) {
  res.json(
    await prisma.resume.findMany({
      where: { userId: res.locals.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        version: true,
        size: true,
        originalName: true,
      },
    }),
  );
}
export async function downloadResume(req: Request, res: Response) {
  const record = await prisma.resume.findFirst({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!record) throw new HttpError(404, "Resume not found");
  res.set("Cache-Control", "no-store").json({
    url: await resumeDownloadUrl(record.fileKey),
  });
}
export async function deleteResume(req: Request, res: Response) {
  const record = await prisma.resume.findFirst({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!record) throw new HttpError(404, "Resume not found");
  // Object deletion is idempotent: retaining the DB row on failure allows a safe retry.
  await removeResume(record.fileKey);
  await prisma.resume.delete({
    where: { id: record.id, userId: res.locals.userId },
  });
  res.status(204).end();
}
