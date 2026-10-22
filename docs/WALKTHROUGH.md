# Portfolio walkthrough

Use your own development Clerk account and synthetic data, not a shared credential. There is no hardcoded demo account or public authentication bypass.

1. Sign in and create two or three applications with different statuses and applied dates. Open the dashboard and change the date range and trend interval. Explain that the stage distribution and rate proxies use current statuses, while new transitions are persisted separately.
2. Search by company/role, filter by location/status/date, change sorting and paginate. Open an application detail page, change its status and notes, and inspect the corresponding structured timeline events.
3. Upload a synthetic text-based PDF with a name and version. Select it on an application. Download through the owner-checked one-minute URL; explain why database keys are preserved while URLs are issued on demand.
4. Run a resume comparison in demo mode. Point out the demo label, exact evidence snippets, missing evidence distinction and heuristic score. Explain how real mode adds backend-only credentials, consent, a compatible provider and Zod/evidence validation. Do not call demo output AI.
5. Schedule interview rounds with an explicit IANA zone and reminder lead time. Show the calendar and completed status event. Run the console worker and inspect `previewed` delivery state; no email is sent.
6. Export CSV, change a synthetic row and import it. Explain atomic validation, bounded batches and spreadsheet formula escaping. Re-importing a file is not idempotent.
7. Run `npm run check` and `npm run test:full`. Discuss real PostgreSQL isolation tests, mocked external services, migration preservation and browser workflows. Show CI configuration and Docker targets without claiming production deployment.
8. Explain tradeoffs: one relational store/queue reduces infrastructure; SKIP LOCKED supports concurrent workers; an uncertain state prevents blindly resending after an ambiguous SES result. Discuss the remaining live-service and operational checks in the progress document.

The three README resume bullets describe implemented code. Do not add user counts, speedups, uptime, cloud deployment or genuine AI usage claims without corresponding evidence.
