import { z } from "zod";
import prisma from "../config/prisma";
import { readResume } from "./storage";
import { extractResumeDocument } from "./pdf";
import { HttpError } from "../lib/errors";
import {
  detectRequirements,
  requirementSchema,
  reviewResume,
} from "./resumeReview";
export const analysisInput = z
  .object({
    resumeId: z.string().min(1).optional(),
    resumeText: z.string().trim().min(20).max(40000).optional(),
    applicationId: z.string().min(1).nullable().optional(),
    jobDescription: z.string().trim().min(50).max(20000),
    requirements: z.array(requirementSchema).max(50).optional(),
    consent: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => !!v.resumeId !== !!v.resumeText,
    "Choose an uploaded PDF or pasted resume text, not both",
  );
export const analysisInclude = {
  resume: { select: { name: true } },
  application: { select: { id: true, company: true, role: true } },
};
export async function resumeTextPreview(userId: string, id: string) {
  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) throw new HttpError(404, "Resume not found");
  let bytes: Uint8Array;
  try {
    bytes = await readResume(resume.fileKey);
  } catch {
    throw new HttpError(
      503,
      "Resume storage is unavailable or the file could not be read. Try again or paste your resume text.",
    );
  }
  const doc = await extractResumeDocument(bytes).catch((error) => {
    throw new HttpError(
      400,
      `${error instanceof HttpError ? error.message : "Unable to extract PDF text"}. Use an unencrypted text-based PDF or paste your resume text.`,
    );
  });
  if (doc.text.trim().length < 20)
    throw new HttpError(
      400,
      "No readable text found. Scanned PDFs require OCR; paste your resume text instead.",
    );
  return doc;
}
export async function analyze(userId: string, input: unknown) {
  const data = analysisInput.parse(input);
  if (
    data.applicationId &&
    !(await prisma.jobApplication.findFirst({
      where: { id: data.applicationId, userId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Application not found");
  // Verify ownership before any private read or failed-attempt history is created.
  if (
    data.resumeId &&
    !(await prisma.resume.findFirst({
      where: { id: data.resumeId, userId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Resume not found");
  let text = data.resumeText ?? "";
  let warnings: string[] = [];
  if (data.resumeId) {
    try {
      const doc = await resumeTextPreview(userId, data.resumeId);
      text = doc.text;
      if (doc.truncated)
        warnings = [
          "Only the first 20 pages / 40,000 characters were reviewed. Paste a shorter version to include different content.",
        ];
    } catch (error) {
      await prisma.analysis.create({
        data: {
          userId,
          resumeId: data.resumeId,
          applicationId: data.applicationId,
          jobDescription: data.jobDescription,
          mode: "rules",
          status: "failed",
          failureReason:
            error instanceof HttpError
              ? error.message
              : "The PDF could not be read. Try pasted text.",
        },
      });
      throw error;
    }
  }
  const requirements =
    data.requirements ?? detectRequirements(data.jobDescription);
  const reservation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    // Interrupted synchronous reviews cannot still be running five minutes later.
    await tx.analysis.updateMany({
      where: {
        userId,
        status: "pending",
        createdAt: { lt: new Date(Date.now() - 5 * 60000) },
      },
      data: {
        status: "failed",
        failureReason:
          "This review was interrupted. Run a new review; this attempt does not count toward your allowance.",
      },
    });
    const count = await tx.analysis.count({
      where: {
        userId,
        status: { in: ["pending", "completed"] },
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    if (count >= 10)
      throw new HttpError(
        429,
        "Daily review limit reached (10 successful or processing reviews per rolling 24 hours). Failed attempts do not count.",
      );
    await tx.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    });
    if (
      data.applicationId &&
      !(await tx.jobApplication.findFirst({
        where: { id: data.applicationId, userId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Application not found");
    return tx.analysis.create({
      data: {
        userId,
        resumeId: data.resumeId,
        applicationId: data.applicationId,
        jobDescription: data.jobDescription,
        mode: "rules",
        status: "pending",
      },
    });
  });
  try {
    const result = { ...reviewResume(text, requirements), warnings };
    return await prisma.analysis.update({
      where: { id: reservation.id },
      data: { result, status: "completed" },
      include: analysisInclude,
    });
  } catch (error) {
    await prisma.analysis.update({
      where: { id: reservation.id },
      data: {
        status: "failed",
        failureReason:
          "Review could not finish. Your inputs have been kept in the form; please retry.",
      },
    });
    throw error;
  }
}
