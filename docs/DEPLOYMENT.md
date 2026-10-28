# Deployment, migration and rollback

## Calendar release gate

The calendar feature is prepared on `Test/calendar-workflow`. Follow [the calendar preview/migration checklist](CALENDAR.md) before release. Do not push this branch to the connected Vercel repository until preview database isolation is configured: the API build runs migrations, and a Preview environment that shares the production database could migrate production before approval.

## Vercel deployment

The frontend project uses root `client` (Vite), and the API uses root `server` (Express). Both track `InterviewTracker_Careerpath/main`. Frontend SPA rewrites are in `client/vercel.json`; `server/src/app.ts` exports the API without starting a persistent listener. The API build generates Prisma and applies the migration chain to the newly provisioned, empty managed database before compiling. Do not reuse that build migration strategy against an unknown existing database.

The managed Prisma Postgres resource uses its Free plan. Private Vercel Blob uses project-scoped OIDC access, with no long-lived Blob token. New object keys have a `vercel-blob:` prefix so existing S3 keys keep their original storage behavior. Download URLs grant only one object's GET access for 60 seconds. Existing local database records and S3 objects are not migrated or changed.

Set backend `DATABASE_URL`, matching Clerk keys, exact HTTPS `CLIENT_ORIGIN`, `NODE_ENV=production`, `AI_MODE=demo`, and `EMAIL_PROVIDER=console`. The Blob connection supplies `BLOB_STORE_ID` and OIDC. Set frontend `VITE_API_URL` to the API origin plus `/api`, and its matching Clerk publishable key. Never place backend secrets in frontend variables. Local Clerk credentials are development-instance keys; the hosted demo retains Clerk's development-mode limitations.

Vercel Functions do not run the separate persistent reminder worker. Email delivery remains disabled. Uploads are capped at 4 MB in the frontend and API to fit Vercel's 4.5 MB request body limit including multipart overhead. Existing stored PDFs up to 5 MB remain readable. Direct browser uploads would be needed for larger new uploads. All paid services and live email/AI require owner approval.

### Hosted acceptance check (2026-10-24)

- Frontend: https://interview-tracker-careerpath.vercel.app
- Backend readiness: https://interview-tracker-api-one.vercel.app/ready returned `{"status":"ready"}`.
- Both Vercel projects track GitHub `main`; pushed deployment fixes triggered builds automatically.
- Google/Clerk login, authenticated dashboard reads, synthetic application create/read, private PDF upload, one-minute signed PDF download (HTTP 200 and exact fixture hash match), unsigned-object denial (HTTP 403), and completed demo keyword analysis passed.
- The synthetic application, PDF object and its analysis history were removed with owner approval. No existing local records or S3 objects were moved.
- Local validation: lint, strict types, both builds, 23 unit/component tests, and 18 isolated database integration tests; additive-migration preservation passed.
- Compatible body-parser/multer security patches were installed. The dependency audit still reports four high-severity entries rooted in Zod (including the Vercel SDK's local CLI-auth dependency chain). Resolving these requires a separately tested major Zod migration; this is not a claim of production security clearance.
- Clerk production authentication needs an owned custom domain, not a `vercel.app` domain. No domain purchase, paid AI, live email, paid hosting or paid database plan was enabled. The reminder worker is not running on Vercel Functions.

## Suggested architecture

Use a static frontend host with HTTPS and SPA fallback, one small always-on container host for the Express API and reminder worker, a managed PostgreSQL service, private S3 storage, Clerk and optional SES. API and worker share the codebase and database, but run as separate processes. This avoids Redis and a second queue service for this portfolio's workload. The durable PostgreSQL queue survives API restarts; a sleeping/free API host also pauses reminders, so use an always-on worker when demonstrating delivery.

Select providers and review their current pricing before provisioning. A static frontend and small PostgreSQL plan reduce idle infrastructure; always-on compute, backups, S3 transfers and email/model calls may incur costs. Serverless API hosting would require a different reminder execution strategy. No provider plan, uptime guarantee or cost estimate is asserted here.

Keep one API replica initially because global rate limits use a local memory store. Multiple reminder workers can claim jobs safely. If running behind a proxy, configure a trusted, fixed proxy boundary before exposing forwarded client IPs; never blindly trust arbitrary X-Forwarded-For. Restrict ingress so clients cannot bypass that boundary.

## Existing database upgrade

The historical migrations are retained exactly as committed. Some old migrations drop resume URLs or introduce required fields without backfills. **Do not reset the database, replay missing old migrations blindly, or use `db push --accept-data-loss`.**

1. Stop writes for a maintenance window and create a PostgreSQL backup plus S3 object inventory. Verify the backup can restore into a separate database. Do not point local tests at this database.
2. Run `prisma migrate status --schema server/prisma/schema.prisma` against a staging copy using locally configured credentials. Inspect actual schema and `_prisma_migrations` against the repository baseline `server/prisma/baseline/schema.prisma`.
3. If all historical migrations are already applied and the schema matches, inspect `20261022000000_saas_additions/migration.sql`. It adds tables, indexes, nullable relationships and defaulted resume metadata. No DROP, rename or S3 mutation occurs.
4. Test `npm run db:migrate` on the staging copy. Verify application/resume counts and all legacy `fileKey`/`fileUrl` values before and after. Test signed downloads against a nonproduction bucket/copy with the same key structure.
5. If historical migration state does not match, stop. A case-specific baseline/backfill is needed. Do not mark migrations applied until their effects have been verified. Prisma's [baselining workflow](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) describes this operation; it is not performed automatically by this repository.
6. After owner approval and a successful staging rehearsal, run `npm run db:migrate` as an explicit release job using a direct migration connection (not a transaction pooler), then start the new API/worker. Review lock times for index creation on large tables.

The automated preservation fixture checks the additive migration on a seeded baseline; it cannot prove an unknown existing database has no drift. Old application timelines remain empty until real new activity occurs.

## New local Docker environment

Compose uses host port **5433** for its new PostgreSQL volume to avoid the user's existing 5432 database. Docker must be running.

```sh
cp server/.env.example server/.env
# Populate development Clerk keys locally; use console/demo for email/AI.
# Set VITE_CLERK_PUBLISHABLE_KEY in your shell or an ignored root .env.
docker compose up -d db
docker compose build
docker compose run --rm api ./node_modules/.bin/prisma migrate deploy --schema server/prisma/schema.prisma
docker compose up -d api worker web
```

Open localhost:8080 and add that origin to the Clerk development setup. This local configuration binds ports to loopback. It uses NODE_ENV=development so HTTP localhost is allowed. It is not a production Compose deployment. Do not remove the volume with `down -v` if it contains data you need.

## Production release checklist

- Rotate exposed keys; use a secret manager/runtime secrets. Only the Clerk publishable key and API URL belong in frontend build arguments.
- Use HTTPS, set NODE_ENV=production, exact CLIENT_ORIGIN, verified Clerk production keys and managed PostgreSQL TLS. Set DATABASE_URL to a runtime secret. Enable provider backups/PITR.
- Configure S3 Block Public Access, encryption and a restricted application role. Include existing legacy keys in its object permissions; the new namespace is `resumes/<userId>/<uuid>.pdf`.
- Use short-lived workload credentials for AWS. SES uses the standard SDK credential chain, not legacy S3 aliases. Verify the SES sender and production sending eligibility separately.
- Keep AI_MODE=demo and EMAIL_PROVIDER=console until paid-provider approval and staging tests are complete. Set AI_MODEL explicitly to a compatible JSON-mode model before enabling real mode.
- Build backend: `docker build --target backend -t interview-tracker-api:<commit> .`
- Build frontend: `docker build --target frontend --build-arg VITE_API_URL=https://<api-host>/api --build-arg VITE_CLERK_PUBLISHABLE_KEY=<public-key> -t interview-tracker-web:<commit> .`
- Run API with `node server/dist/index.js`; run worker with `node server/dist/jobs/worker.js` using the same backend image. Deploy static frontend assets with SPA fallback. Runtime frontend environment changes require rebuilding the bundle.
- Complete staging cross-user CRUD, old/new resume download, interview time zone, console preview, SES receipt and AI consent/evidence checks. Check `/health` and `/ready` without exposing database errors.
- Review `uncertain`/`failed` reminder counts and database connection limits. Do not log request bodies, tokens, PDF text or email content.

GitHub Actions verifies the build on push/PR; publication and production migration remain manual approval steps. Container builds are defined in CI; if the local Docker daemon is unavailable, local container execution is unverified.

## Reminder recovery

A due job is locked transactionally, its attempts incremented, and its status set to processing. Explicit provider throttling/service rejection returns it to pending with capped exponential backoff; after five attempts it fails. Provider success stores a receipt. Local preview stores `previewed`.

An expired processing lease or network ambiguity sets `uncertain`. SES cannot accept a deduplication key; automatically retrying after a crash between sending and saving its receipt risks a duplicate. An operator should check provider logs and mark uncertain jobs sent or deliberately queue them again **only after confirming no delivery occurred**. This conservative policy may delay a reminder in exchange for avoiding blind duplicate sends.

## Rollback

1. Stop the reminder worker and API writes. Keep database and bucket backups.
2. Roll the API/frontend image back to the previous tested release. The additive schema keeps the original columns, so old code can read applications/resumes. New records remain stored.
3. Old code logs a Clerk secret and uses public resume URLs; the original repository baseline is **not** a secure production rollback target. Prefer the last hardened release or keep the service in maintenance mode until fixed.
4. Leave new tables/columns in place. Do not drop them automatically; dropping destroys interview/analysis/activity/reminder data. Correct issues with a forward migration, or restore a verified database snapshot under a separately approved recovery plan.
5. Before restarting the worker, reconcile processing/uncertain jobs to avoid duplicate email. S3 deletion is irreversible without bucket versioning; enable versioning if recoverability is required.
