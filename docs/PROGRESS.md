# Upgrade progress

## Shared calendar and 30-day review — 2026-10-27

Branch: `Test/calendar-workflow`. [Review and rollout](CALENDAR.md).

- [x] Ten applications per page with existing filters, sorting and URL history
- [x] Manual Applied review at 30 days, ten candidates per page, server eligibility/ownership rechecks, skipped results and timeline updates
- [x] Shared OA/Interview/Other event form across Applications, Calendar and Overview; optional application/status update, date/zone/all-day handling and dashboard-only reminders
- [x] Edit/reschedule/complete/cancel, category chips, Today/month controls, selected-day agenda, responsive light/dark layouts and reduced motion
- [x] Additive Interview-table migration, deterministic follow-up conversion, retained legacy fields/history and disabled follow-up job creation/claims
- [x] Disposable-database preservation/retry, concurrency/ownership/boundary/date tests and desktop/mobile browser journeys
- [x] Local synthetic review preview; production unchanged
- [ ] User review, isolated hosted preview credentials and staging-copy migration rehearsal before production approval

Historical release records below describe previous versions.

Branch: `Test/indigo-workspace`, based on the local SaaS upgrade at `b4030e8`. Original baseline: a354e1b.

## Indigo glass refresh

- [x] Shared indigo/lavender light theme and navy dark theme; glass navigation with opaque content and a solid fallback
- [x] Responsive navigation, application cards on mobile, readable typography and theme-aware dialogs
- [x] User-scoped follow-up action center, earliest ten due within seven days including overdue items, terminal stages excluded
- [x] Analytics drill-down links preserve date range; action-center dates remain independent
- [x] Quick status updates with pending/error recovery; active filter chips/reset and URL-driven search history
- [x] Structured detail layout, selected-day calendar agenda, consistent resume cards and matching workflow steps
- [x] Preserve existing application/follow-up timestamps when their dates are unchanged
- [x] Targeted per-user cache invalidation and removal of eight verified unused files
- [x] 20 unit/component/PDF tests, 18 database API tests, 4 browser tests, screenshots, lint, typechecks and production builds
- [x] Measured bundle and controlled query-refresh comparison recorded in [verification](VERIFICATION.md)

No schema migration or additional dependency is required by this refresh. Implementation is local; deployment, live-provider acceptance and production data changes remain outside this release.

## SaaS foundation (previous upgrade)

- [x] Audit architecture, existing functionality, security issues, data migration risks and phase complexity
- [x] Strict Clerk-protected API boundaries, validation, owner-scoped mutation predicates, safe errors, CORS and limits
- [x] Paginated/searchable/filterable/sortable application CRUD and detail pages
- [x] Database-derived dashboard totals, stage distribution, date filters, trends, status-based rate proxies, real activity and upcoming rounds
- [x] Atomic CSV import and filtered/formula-safe CSV export
- [x] Additive Prisma schema/migration for activities, interview rounds, resume selection/version metadata, analyses and reminders
- [x] Private S3 operations, validated/limited uploads, short-lived download URLs and compensating cleanup
- [x] Demo matching, optional backend provider, bounded extraction, Zod/evidence validation, consent, quotas and per-user history
- [x] Interview scheduling/calendar, round status/notes API, follow-up dates and configurable reminder offsets
- [x] Durable concurrent worker, console/SES adapters, retry backoff, delivery statuses and ambiguous-delivery handling
- [x] Responsive light/dark UI, query caching, on-demand page loading, reusable accessible dialogs and toast/error/empty states
- [x] Unit/component/API/browser test implementation and isolated PostgreSQL runner
- [x] Fresh migration chain and seeded legacy-resume preservation test
- [x] CI checks and Docker targets; deployment, rollback, privacy and setup runbooks
- [x] Accurate README, architecture diagram, walkthrough and three portfolio bullets

## Previous foundation verification

Verified locally: 15 unit/component/PDF tests, 16 PostgreSQL API tests, 2 Chromium E2E tests. Fresh migrations and legacy resume preservation also pass. External provider interactions are mocked in tests.

- [x] Lint and client/server TypeScript checks
- [x] Unit/component/PDF-worker tests
- [x] Real PostgreSQL API isolation/transaction tests with external providers mocked
- [x] Full browser workflow, responsive/theme checks and desktop/mobile screenshot review
- [x] Production frontend/backend builds
- [x] Dependency security audit: zero known vulnerabilities at last check
- [x] GitHub Linux CI, full test suite and both container builds passed for code commit 1071795 ([run](https://github.com/Rose-Wei10/Inteview-Tracker/actions/runs/39697360166))

## External acceptance still required

- [ ] Owner rotates exposed AWS/Clerk credentials; review old logs/history
- [ ] Inspect/backup/rehearse the actual existing database before approved migration
- [ ] Configure and verify hosted Clerk login, private bucket policy and legacy object downloads
- [ ] Approve/configure paid AI/SES; test consent, real output validation and actual delivery in staging
- [x] Verify Linux frontend/backend container builds in GitHub CI (local Docker daemon remains unavailable)
- [ ] Approve hosting/costs and deploy; complete health/backup/recovery acceptance

No existing database, bucket object or production environment has been changed. Optional Kanban, OCR, antivirus scanning, account deletion/retention, shared distributed rate limits and calendar synchronization remain future enhancements, not completed features.
