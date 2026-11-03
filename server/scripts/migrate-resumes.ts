// Manual operation only. Never called by builds, migrations or application startup.
import { config } from "dotenv";
import { open, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
async function main() {
  const envFile = option("--env-file");
  if (!envFile) throw Error("Choose an explicit private --env-file");
  const loaded = config({
    path: resolve(envFile),
    override: true,
    quiet: true,
  });
  if (loaded.error) throw Error("Environment file could not be read");
  const apply = args.includes("--apply");
  if (apply && (!args.includes("--capacity-reviewed") || !option("--manifest")))
    throw Error(
      "Apply requires --capacity-reviewed, --remaining-bytes and a private --manifest path",
    );
  const capacity = Number(option("--remaining-bytes"));
  if (apply && (!Number.isSafeInteger(capacity) || capacity < 0))
    throw Error("Provide reviewed free remaining bytes");
  const { default: prisma } = await import("../src/config/prisma");
  const { readResume } = await import("../src/services/storage");
  const { migrateResume } = await import("../src/services/resumeMigration");
  const { get, put } = await import("@vercel/blob");
  let journal: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const records = await prisma.resume.findMany({
      select: { id: true, userId: true, fileKey: true, fileUrl: true },
      orderBy: { id: "asc" },
    });
    const summary: Record<string, number> = {
      total: records.length,
      blob: 0,
      eligible: 0,
      sourceErrors: 0,
      bytes: 0,
      migrated: 0,
      conflict: 0,
    };
    const eligible = [];
    const readSource = async (key: string) => {
      let last: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await readResume(key);
        } catch (error) {
          last = error;
        }
      }
      throw last;
    };
    let copiedBytes = 0;
    const io = {
      readSource,
      readTarget: async (key: string) => {
        const object = await get(key, { access: "private", useCache: false });
        if (!object) return null;
        if (object.statusCode !== 200 || object.blob.size > 5 * 1024 * 1024)
          throw Error("Destination unavailable");
        return new Uint8Array(await new Response(object.stream).arrayBuffer());
      },
      copy: async (key: string, bytes: Uint8Array) => {
        if (copiedBytes + bytes.length > capacity)
          throw Error("Free capacity changed; stop and review");
        copiedBytes += bytes.length;
        await put(key, Buffer.from(bytes), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/pdf",
        });
      },
      replace: async (record: (typeof records)[number], key: string) => {
        const result = await prisma.resume.updateMany({
          where: record,
          data: { fileKey: key, fileUrl: "" },
        });
        return result.count === 1;
      },
      journal: async (entry: Record<string, unknown>) => {
        if (!journal) throw Error("Private manifest unavailable");
        await journal.write(
          JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n",
        );
        await journal.sync();
      },
    };
    for (const record of records) {
      try {
        const result = await migrateResume(record, io);
        if (result.status === "already-blob") summary.blob++;
        else {
          summary.eligible++;
          summary.bytes += result.bytes;
          eligible.push(record);
        }
      } catch {
        summary.sourceErrors++;
      }
    }
    // Only aggregate counts leave this command; keys and rollback mappings stay private.
    console.log(
      JSON.stringify({
        mode: apply ? "apply-preflight" : "dry-run",
        ...summary,
      }),
    );
    if (!apply) {
      if (summary.sourceErrors) process.exitCode = 1;
      return;
    }
    if (summary.sourceErrors)
      throw Error("Resolve every source error before applying");
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN)
      throw Error("Private Blob connection required");
    if (summary.bytes > capacity)
      throw Error("Copies exceed reviewed free capacity; no writes performed");
    const path = resolve(option("--manifest")!);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    try {
      const info = await stat(path);
      if ((info.mode & 0o077) !== 0)
        throw Error("Manifest must be private (0600)");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    journal = await open(path, "a", 0o600);
    for (const record of eligible) {
      const result = await migrateResume(record, io, true);
      summary[result.status]++;
    }
    console.log(JSON.stringify({ mode: "apply-complete", ...summary }));
  } finally {
    await journal?.close();
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Migration stopped. No S3 originals were deleted. Check configuration, source availability, free capacity and private manifest; rerun dry-run before retrying.",
  );
  process.exitCode = 1;
});
