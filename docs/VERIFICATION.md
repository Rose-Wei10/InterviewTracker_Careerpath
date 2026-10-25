# Verification record

## Indigo glass refresh — 2026-10-24

Local macOS arm64 verification on Node 26.12.1, based on `b4030e8`:

- `npm run check`: lint, client/server typechecks, **20 unit/component/PDF tests**, and both production builds pass.
- `node scripts/test-db.mjs --e2e`: **18 PostgreSQL API tests and 4 Chromium browser tests** pass using a throwaway database. Historical migrations and the legacy resume preservation fixture also pass. No existing database is used.
- Follow-up API cases cover overdue/now/exact seven-day boundary, one millisecond outside the window, null dates, terminal statuses, ordering, a ten-item cap with the full count, analytics-range independence, cleared dates and cross-user isolation.
- UI cases cover filter chips/reset, status pending/success/failure, empty follow-ups, URL Back/Forward, dashboard drill-down, follow-up rescheduling/clearing, unchanged timestamp preservation, calendar selection, Escape/focus restoration, and dark dialog surfaces.
- All six signed-in pages are checked at 390, 768 and 1440 px in both themes for page-level horizontal overflow. Calendar/table scrolling remains contained within its own region when necessary. Reduced-motion behavior is exercised.
- Screenshots were compared with the previous sage dashboard and reviewed for desktop/mobile layouts. Records are synthetic API-created opportunities; resume metadata and matching configuration/history in the page-layout test are browser fixtures. These images do not demonstrate live S3 or AI integration.

### Measured cost and cleanup

Production build output, kB as reported by Vite (rounded):

| Asset                | Before gzip | After gzip | Interpretation                                               |
| -------------------- | ----------: | ---------: | ------------------------------------------------------------ |
| Main stylesheet      |        5.52 |       6.63 | Adds responsive cards, glass, agenda and interaction styling |
| Main JavaScript      |      113.52 |     113.54 | Shared entry is essentially unchanged                        |
| Dashboard JavaScript |        3.07 |       3.65 | Adds follow-up actions and drill-down links                  |
| Chart vendor chunk   |      106.09 |     106.09 | Remains independently split; no new chart/animation library  |

Eight unused source files (848 lines) were removed after checking imports and entry points: old page/header styles, the unused header component and obsolete service type re-exports. These files were already outside the production import graph, so deleting them does **not** explain a bundle-size reduction. Added behavior has a small bundle cost; no latency or rendering-speed gain is claimed.

The query-cache regression test creates nine active query observers (eight groups for Alice plus Bob’s application list). A blanket invalidation calls all nine query functions; a status update’s scoped invalidation calls only Alice’s applications, application detail and dashboard functions: **9 versus 3** in that controlled scenario. This is a cache-behavior comparison, not a production traffic benchmark; inactive queries and actual page composition change the real request count.

Not reverified: Safari/Firefox or physical mobile devices, live Clerk/S3/SES/AI, hosted database migrations, production load, hosting or container runtime. No deployment, paid requests, schema changes, or production data writes were performed.

## Previous SaaS upgrade verification

Local verification on 2026-10-21, macOS arm64, Node 25.9.0:

- `npm run check`: lint, client/server strict TypeScript checks, 15 unit/component/PDF-worker tests and both production builds pass.
- `npm run test:full`: all historical migrations plus the additive migration apply to a fresh throwaway PostgreSQL database; a separate seeded baseline preserves original resume keys/URLs; 16 API integration tests and 2 Chromium E2E tests pass.
- Concurrency checks cover per-user analysis reservations and reminder claims. Isolation checks cover another user's applications, resume downloads/deletes, analysis and scheduling access.
- AI-compatible requests use a mocked provider to test consent, `store:false`, valid evidence and rejection of fabricated excerpts. No paid provider request was made.
- Generated desktop and mobile screenshots use synthetic records created through the real API. Visually reviewed; mobile document has no horizontal overflow. Recharts animations are disabled to keep screenshots/data stable.
- `npm audit` reports zero known vulnerabilities after dependency updates. This is a point-in-time report.
- Existing databases, S3 objects, Clerk credentials and production infrastructure were not changed.

GitHub Linux CI passed for code commit `1071795`, including both container builds and the full migration/API/browser suite: [verified run](https://github.com/Rose-Wei10/Inteview-Tracker/actions/runs/39697360166).

Pending separate verification: live Clerk hosted sign-in; S3/IAM privacy and legacy-object downloads; managed PostgreSQL connection/migration rehearsal; SES delivery/permissions; approved real AI provider acceptance; hosting, backup and restore operations. Local Docker was not running, so container runtime behavior is not claimed as locally verified.
