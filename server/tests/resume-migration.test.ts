import { expect, it, vi } from "vitest";
import {
  migrateResume,
  migrationKey,
  type MigrationIO,
} from "../src/services/resumeMigration";
const record = {
  id: "r",
  userId: "u",
  fileKey: "old.pdf",
  fileUrl: "legacy-url",
};
function fixture() {
  let target: Uint8Array | null = null;
  const io: MigrationIO = {
    readSource: vi.fn(async () => Buffer.from("%PDF-source")),
    readTarget: vi.fn(async () => target),
    copy: vi.fn(async (_key, bytes) => {
      target = bytes;
    }),
    replace: vi.fn(async () => true),
    journal: vi.fn(async () => {}),
  };
  return io;
}
it("dry-run only reads, then verifies bytes before updating a reference", async () => {
  const io = fixture();
  expect((await migrateResume(record, io)).status).toBe("eligible");
  expect(io.copy).not.toHaveBeenCalled();
  expect(io.replace).not.toHaveBeenCalled();
  expect((await migrateResume(record, io, true)).status).toBe("migrated");
  expect(io.replace).toHaveBeenCalledWith(
    record,
    "vercel-blob:" + migrationKey(record),
  );
  expect(vi.mocked(io.journal).mock.calls.map(([e]) => e.phase)).toEqual([
    "prepared",
    "verified",
    "committed",
  ]);
});
it("retries interrupted copies without duplication and skips migrated references", async () => {
  const io = fixture();
  vi.mocked(io.replace).mockRejectedValueOnce(Error("interrupted"));
  await expect(migrateResume(record, io, true)).rejects.toThrow("interrupted");
  await migrateResume(record, io, true);
  expect(io.copy).toHaveBeenCalledTimes(1);
  expect(
    (await migrateResume({ ...record, fileKey: "vercel-blob:done" }, io, true))
      .status,
  ).toBe("already-blob");
  expect(migrationKey(record)).not.toBe(
    migrationKey({ ...record, userId: "another" }),
  );
});
it("missing sources, interrupted uploads and checksum mismatches never update the database", async () => {
  const missing = fixture();
  vi.mocked(missing.readSource).mockRejectedValue(Error("missing"));
  await expect(migrateResume(record, missing, true)).rejects.toThrow("missing");
  expect(missing.copy).not.toHaveBeenCalled();
  const interrupted = fixture();
  vi.mocked(interrupted.copy).mockRejectedValue(Error("offline"));
  await expect(migrateResume(record, interrupted, true)).rejects.toThrow(
    "offline",
  );
  expect(interrupted.replace).not.toHaveBeenCalled();
  const mismatch = fixture();
  vi.mocked(mismatch.readTarget).mockResolvedValue(Buffer.from("%PDF-wrong!"));
  await expect(migrateResume(record, mismatch, true)).rejects.toThrow(
    "verification failed",
  );
  expect(mismatch.replace).not.toHaveBeenCalled();
});
it("retains concurrent reference changes and records a conflict", async () => {
  const io = fixture();
  vi.mocked(io.replace).mockResolvedValue(false);
  expect((await migrateResume(record, io, true)).status).toBe("conflict");
  expect(io.journal).toHaveBeenLastCalledWith(
    expect.objectContaining({ phase: "conflict" }),
  );
});
it("cannot copy anything when the rollback journal fails", async () => {
  const io = fixture();
  vi.mocked(io.journal).mockRejectedValue(Error("disk full"));
  await expect(migrateResume(record, io, true)).rejects.toThrow("disk full");
  expect(io.copy).not.toHaveBeenCalled();
});
