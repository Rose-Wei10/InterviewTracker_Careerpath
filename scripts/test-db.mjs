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
const env = {
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: "test",
  REVIEW_STORAGE_DIR: join(dir, "browser-resumes"),
};
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
  preserve.on("error", () => {});
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
  await preserve.query(`
    INSERT INTO "JobApplication" (id,company,role,"userId","updatedAt","followUpAt",status) VALUES
    ('active','Active','Engineer','legacy',now(),'2026-10-01 18:30:00','Applied'),
    ('terminal','Terminal','Engineer','legacy',now(),'2026-10-02 18:30:00','Offer');
    INSERT INTO "Interview" (id,"applicationId",title,"startsAt","timeZone",type,notes) VALUES
    ('old-round','active','Original round','2026-12-01 18:00:00','America/Los_Angeles','video','Keep these notes');
    INSERT INTO "Reminder" (id,"applicationId","interviewId",kind,"dueAt","dedupeKey",status) VALUES
    ('old-round-reminder','active','old-round','interview','2026-12-01 17:00:00','round','pending'),
    ('old-follow','active',NULL,'follow-up','2026-10-01 18:30:00','follow','processing'),
    ('old-sent','active',NULL,'follow-up','2026-09-01 18:30:00','sent','sent');
  `);
  const calendarMigration = await readFile(
    "server/prisma/migrations/20261027000000_calendar_events/migration.sql",
    "utf8",
  );
  await preserve.query(calendarMigration);
  await preserve.query(calendarMigration);
  const rounds = (
    await preserve.query(
      `SELECT *, "startsAt" AT TIME ZONE 'UTC' AS "startsAt" FROM "Interview" ORDER BY id`,
    )
  ).rows;
  if (
    rounds.length !== 2 ||
    rounds[0].id !== "legacy-follow-up:active" ||
    rounds[0].startsAt.toISOString() !== "2026-10-01T18:30:00.000Z" ||
    rounds[1].id !== "old-round" ||
    rounds[1].userId !== "legacy" ||
    rounds[1].notes !== "Keep these notes" ||
    rounds[1].reminderMinutes !== 60 ||
    rounds[1].startsAt.toISOString() !== "2026-12-01T18:00:00.000Z"
  )
    throw new Error(
      "Calendar migration lost data or duplicated converted events",
    );
  const deliveries = (
    await preserve.query('SELECT id,status FROM "Reminder" ORDER BY id')
  ).rows;
  if (
    deliveries.length !== 3 ||
    deliveries.find((v) => v.id === "old-follow").status !== "cancelled" ||
    deliveries.find((v) => v.id === "old-sent").status !== "sent"
  )
    throw new Error("Legacy delivery preservation failed");
  console.log(
    "Calendar migration preserves IDs, notes, relationships and times; retries create no duplicates and retain delivery history.",
  );
  await preserve.query(
    `INSERT INTO "Analysis" (id,"userId","resumeId","jobDescription",mode,result) VALUES ('old-report','legacy','resume','Original job snapshot','demo','{"supportedSkills":[],"missingSkills":[],"improvements":[],"preparationTopics":[],"heuristicScore":0,"assessmentLabel":"Legacy"}'),('old-failed','legacy','resume','Failed job snapshot','demo',NULL);`,
  );
  const beforeReview = (
    await preserve.query(
      'SELECT id,"resumeId","jobDescription",mode,result,"createdAt" FROM "Analysis" ORDER BY id',
    )
  ).rows;
  const reviewMigration = await readFile(
    "server/prisma/migrations/20261028000000_free_resume_review/migration.sql",
    "utf8",
  );
  await preserve.query(reviewMigration);
  await preserve.query(reviewMigration);
  const afterReview = (
    await preserve.query(
      'SELECT id,"resumeId","jobDescription",mode,result,"createdAt" FROM "Analysis" ORDER BY id',
    )
  ).rows;
  if (JSON.stringify(beforeReview) !== JSON.stringify(afterReview))
    throw Error("Legacy report data changed");
  const reportStates = (
    await preserve.query('SELECT id,status FROM "Analysis" ORDER BY id')
  ).rows;
  if (
    reportStates[0].status !== "failed" ||
    reportStates[1].status !== "completed"
  )
    throw Error("Legacy report state backfill failed");
  console.log(
    "Free review migration preserves legacy reports and backfills completed/failed states; retries are safe.",
  );
  await run("./node_modules/.bin/prisma", [
    "migrate",
    "diff",
    "--from-url",
    preserveUrl,
    "--to-schema-datamodel",
    "server/prisma/schema.prisma",
    "--exit-code",
  ]);
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
  if (process.argv.includes("--preview")) {
    const api = spawn(
      "./node_modules/.bin/tsx",
      ["server/tests/e2e-server.ts"],
      { env, stdio: "inherit" },
    );
    const web = spawn(
      "./node_modules/.bin/vite",
      [
        "--config",
        "client/vite.config.ts",
        "client",
        "--mode",
        "e2e",
        "--host",
        "127.0.0.1",
        "--port",
        "5179",
        "--strictPort",
      ],
      {
        env: {
          ...env,
          VITE_API_URL: "http://127.0.0.1:5019/api",
          VITE_CLERK_PUBLISHABLE_KEY: "e2e-placeholder",
        },
        stdio: "inherit",
      },
    );
    console.log(
      "Synthetic review preview: http://127.0.0.1:5179 — Ctrl+C stops both servers and the disposable database.",
    );
    try {
      await new Promise((resolve, reject) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
        for (const child of [api, web]) {
          child.once("error", reject);
          child.once("exit", () => resolve());
        }
      });
    } finally {
      await Promise.all(
        [api, web].map(
          (child) =>
            new Promise((resolve) => {
              if (child.exitCode !== null || child.signalCode !== null)
                return resolve();
              child.once("exit", resolve);
              child.kill("SIGTERM");
            }),
        ),
      );
    }
  }
} finally {
  await pg.stop();
}
