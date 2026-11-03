import { createHash } from "node:crypto";
export type MigrationResume = {
  id: string;
  userId: string;
  fileKey: string;
  fileUrl: string;
};
export type MigrationIO = {
  readSource: (key: string) => Promise<Uint8Array>;
  readTarget: (key: string) => Promise<Uint8Array | null>;
  copy: (key: string, bytes: Uint8Array) => Promise<void>;
  replace: (record: MigrationResume, key: string) => Promise<boolean>;
  journal: (entry: Record<string, unknown>) => Promise<void>;
};
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export function migrationKey(record: MigrationResume) {
  return `resumes/migrated-s3/${hash(JSON.stringify([record.id, record.userId, record.fileKey]))}.pdf`;
}
export async function migrateResume(
  record: MigrationResume,
  io: MigrationIO,
  apply = false,
) {
  if (record.fileKey.startsWith("vercel-blob:"))
    return { status: "already-blob", bytes: 0 };
  const bytes = await io.readSource(record.fileKey);
  if (
    !bytes.length ||
    bytes.length > 5 * 1024 * 1024 ||
    Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw Error("Source is missing, oversized or not a PDF");
  const digest = hash(bytes),
    target = migrationKey(record);
  if (!apply) return { status: "eligible", bytes: bytes.length };
  const entry = {
    resume: record,
    target: `vercel-blob:${target}`,
    sha256: digest,
    bytes: bytes.length,
  };
  await io.journal({ ...entry, phase: "prepared" });
  const existing = await io.readTarget(target);
  if (!existing) {
    try {
      await io.copy(target, bytes);
    } catch (error) {
      // A retry or concurrent runner may have created the deterministic destination.
      if (!(await io.readTarget(target))) throw error;
    }
  }
  const saved = await io.readTarget(target);
  if (!saved || saved.length !== bytes.length || hash(saved) !== digest)
    throw Error("Destination verification failed; database unchanged");
  await io.journal({ ...entry, phase: "verified" });
  const changed = await io.replace(record, entry.target);
  await io.journal({ ...entry, phase: changed ? "committed" : "conflict" });
  return { status: changed ? "migrated" : "conflict", bytes: bytes.length };
}
