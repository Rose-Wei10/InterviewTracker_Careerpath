import { s3 } from "../src/config/aws";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdirSync, mkdtempSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app";
if (
  process.env.NODE_ENV !== "test" ||
  !process.env.DATABASE_URL?.includes("interview_tracker_test")
)
  throw new Error("E2E server requires an isolated test DB");
// The browser sandbox stores synthetic PDFs on disk; it never contacts S3 or Blob.
process.env.AWS_BUCKET_NAME = "browser-test-only";
const storageDir =
  process.env.REVIEW_STORAGE_DIR ??
  mkdtempSync(join(tmpdir(), "tracker-browser-resumes-"));
mkdirSync(storageDir, { recursive: true });
Object.assign(s3, {
  send: async (
    command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
  ) => {
    const path = join(
      storageDir,
      createHash("sha256")
        .update(command.input.Key ?? "")
        .digest("hex"),
    );
    if (command instanceof PutObjectCommand) {
      if (!Buffer.isBuffer(command.input.Body))
        throw Error("Browser PDF fixture must be a buffer");
      await writeFile(path, command.input.Body);
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const bytes = await readFile(path);
      return {
        ContentLength: bytes.length,
        Body: { transformToByteArray: async () => new Uint8Array(bytes) },
      };
    }
    if (command instanceof DeleteObjectCommand) {
      await rm(path, { force: true });
      return {};
    }
    throw Error("Unexpected storage command in browser sandbox");
  },
});
createApp({
  origin: "http://127.0.0.1:5179",
  testRateLimit: 1000,
  auth: (req, res, next) => {
    if (req.header("authorization") !== "Bearer browser-test-token") {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.locals.userId = req.get("x-browser-test-user") ?? "e2e-user";
    next();
  },
}).listen(5019, "127.0.0.1");
