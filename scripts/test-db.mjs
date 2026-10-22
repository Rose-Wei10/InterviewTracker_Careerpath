// Starts only a new throwaway database. Never reads DATABASE_URL from the user's environment.
import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
const server = net.createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
const dir = await mkdtemp(join(tmpdir(), "interview-test-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(dir, "db"),
  port,
  user: "postgres",
  password: "test-only",
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
const url = `postgresql://postgres:test-only@127.0.0.1:${port}/interview_tracker_test`;
const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "test" };
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("interview_tracker_test");
  // Migration preservation fixture: recreate the exact baseline schema and seed a legacy object.
  const client = pg.getPgClient();
  await client.connect();
  await client.query("CREATE DATABASE migration_preservation");
  await client.end();
  const preserveUrl = url.replace(
    "interview_tracker_test",
    "migration_preservation",
  );
  const { Client } = await import("pg");
  const preserve = new Client({ connectionString: preserveUrl });
  await preserve.connect();
  const sql = execFileSync(
    "./node_modules/.bin/prisma",
    [
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "server/prisma/baseline/schema.prisma",
      "--script",
    ],
    { encoding: "utf8" },
  );
  await preserve.query(sql);
  await preserve.query(
    `INSERT INTO "User" (id) VALUES ('legacy'); INSERT INTO "Resume" (id,name,"fileKey","fileUrl","userId") VALUES ('resume','Legacy','original-private-key.pdf','https://legacy.invalid/original','legacy');`,
  );
  await preserve.query(
    await readFile(
      "server/prisma/migrations/20261022000000_saas_additions/migration.sql",
      "utf8",
    ),
  );
  const saved = await preserve.query(
    'SELECT "fileKey","fileUrl",version FROM "Resume"',
  );
  if (
    saved.rows[0].fileKey !== "original-private-key.pdf" ||
    saved.rows[0].version !== 1
  )
    throw new Error("Migration preservation failed");
  await preserve.end();
  console.log("Additive migration preserves legacy resume keys and URLs.");
  await run("./node_modules/.bin/prisma", [
    "migrate",
    "deploy",
    "--schema",
    "server/prisma/schema.prisma",
  ]);
  await run("npm", ["run", "test:integration"]);
  if (process.argv.includes("--e2e")) await run("npm", ["run", "test:e2e"]);
} finally {
  await pg.stop();
}
