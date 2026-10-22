# Repository audit — 2026-10-21

Baseline: a354e1b (`main`). Upgrade branch: `feat/saas-upgrade`.

## Actual architecture

Two independent npm packages: Vite/React 19/TypeScript client and Express 5/TypeScript CommonJS server. Clerk verifies requests; Prisma 5 accesses PostgreSQL. Three models: User (Clerk ID), JobApplication and Resume. AWS SDK v3 stores files in S3. MongoDB model and v2 AWS dependencies are unused remnants. No tests, CI, Docker, backend build script, reminder worker, AI integration or interview model exists.

## Implemented features and limits

Application create/list/update/delete and status changes; edit dialog; Clerk sign-in and protected client pages; resume upload/list/delete. Most reads and deletes check ownership. Dashboard counts a subset of statuses in memory, omits Final Round, and returns empty chart/interview arrays. Activity renders application creations using incorrect MongoDB field names. No detail API despite a frontend service method. No filtering, pagination, import/export, scheduling or persisted timeline. README overstates chart, activity and statistics behavior.

## Critical findings, in priority order

1. Server prints Clerk secret at startup. Credentials pasted in chat must be rotated externally. Never log token/auth objects or private resume data.
2. PUT passes `req.body` to Prisma: mass assignment permits ownership/ID changes. POST lacks an authentication guard. Add strict request allowlists and owner predicates to mutations.
3. Unbounded memory uploads with no PDF verification; raw S3 URLs assume public access. Authenticate before parsing files; limit bytes, verify content and sign private downloads.
4. No centralized error handling, validation, CORS allowlist, rate limits or environment checks. AWS configuration is evaluated before dotenv loads.
5. Frontend hardcodes multiple localhost ports, caches an expiring token, logs applications and silently stays loading on failures.
6. Broken build configuration: client references root tsconfig that includes server; root node config points to nonexistent Vite config; server has no build script; Prisma 5 project contains an incompatible newer prisma.config.ts.
7. Historical migrations DROP resume URLs and add NOT NULL columns without backfill. Do not reset or replay these on existing data. Back up and inspect migration state first.
8. Missing ownership/date indexes and structured events; dashboard loads every full row. No test evidence supports README security claims.

## Database design

Keep User IDs, application status strings and legacy Resume.fileKey/fileUrl to preserve compatibility and stored objects. Add nullable application resumeId/followUpAt, indexed activities with JSON metadata, interview rounds with UTC instant plus IANA zone, resume size/version metadata, per-user analysis history, and durable reminder rows with unique deduplication keys, attempts, leases and provider IDs. Transactions couple mutations to timeline and reminder creation. All new changes are additive; supplied SQL is reviewed on a disposable DB before any live migration. Existing historical data cannot reconstruct past funnel transitions; label current-stage distributions honestly.

## Prioritized plan and complexity

| Phase | Work                                                                                                                                        | Complexity |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1     | Audit, baseline, exposed-secret guidance, branch, checklist                                                                                 | Small      |
| 2     | Auth/validation/error handling; indexed paginated CRUD/detail; real dashboard; search/filter UI                                             | Large      |
| 3     | Private resume storage, analysis with schema/evidence checks and demo mode; interview rounds, persistent retryable reminders, timeline, CSV | Very large |
| 4     | Accessible responsive UI, query cache, behavior/integration/E2E tests, CI, container build and deployment runbook                           | Large      |
| 5     | Accurate README, architecture, migration/rollback/privacy notes, truthful portfolio bullets                                                 | Medium     |

No cloud deployment, live email, paid AI calls or existing database mutations are part of local verification. External Clerk/S3/SES/AI behavior requires separately configured services and consent to use paid resources.
