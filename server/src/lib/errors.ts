import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { Prisma } from "@prisma/client";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        message: "Invalid request",
        errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof MulterError) {
    res
      .status(400)
      .json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "PDF must be 5 MB or smaller"
            : "Invalid upload",
      });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    res.status(404).json({ message: "Record not found" });
    return;
  }
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 500;
  res
    .status(status === 400 || status === 413 ? status : 500)
    .json({
      message:
        status === 400
          ? "Malformed request"
          : status === 413
            ? "Request is too large"
            : "Unable to complete request",
    });
};
