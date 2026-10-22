import type { Request, Response } from "express";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import prisma from "../config/prisma";
import { s3 } from "../config/aws";
import { HttpError } from "../lib/errors";
const metadata = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    version: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export function bucket() {
  if (!process.env.AWS_BUCKET_NAME)
    throw new HttpError(503, "Resume storage is not configured");
  return process.env.AWS_BUCKET_NAME;
}
export async function createResume(req: Request, res: Response) {
  const data = metadata.parse(req.body),
    file = req.file;
  if (!file || file.buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new HttpError(400, "A valid PDF is required");
  const userId = String(res.locals.userId),
    key = `resumes/${userId}/${randomUUID()}.pdf`,
    Bucket = bucket();
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: file.buffer,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
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
    await s3
      .send(new DeleteObjectCommand({ Bucket, Key: key }))
      .catch(() =>
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
  res
    .set("Cache-Control", "no-store")
    .json({
      url: await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket(),
          Key: record.fileKey,
          ResponseContentDisposition: 'attachment; filename="resume.pdf"',
        }),
        { expiresIn: 60 },
      ),
    });
}
export async function deleteResume(req: Request, res: Response) {
  const record = await prisma.resume.findFirst({
    where: { id: String(req.params.id), userId: res.locals.userId },
  });
  if (!record) throw new HttpError(404, "Resume not found");
  // S3 deletion is idempotent: retaining the DB row on failure allows a safe retry.
  await s3.send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: record.fileKey }),
  );
  await prisma.resume.delete({
    where: { id: record.id, userId: res.locals.userId },
  });
  res.status(204).end();
}
