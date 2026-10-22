# Verification record

Local verification on 2026-10-21, macOS arm64, Node 25.9.0:

- `npm run check`: lint, client/server strict TypeScript checks, 15 unit/component/PDF-worker tests and both production builds pass.
- `npm run test:full`: all historical migrations plus the additive migration apply to a fresh throwaway PostgreSQL database; a separate seeded baseline preserves original resume keys/URLs; 16 API integration tests and 2 Chromium E2E tests pass.
- Concurrency checks cover per-user analysis reservations and reminder claims. Isolation checks cover another user's applications, resume downloads/deletes, analysis and scheduling access.
- AI-compatible requests use a mocked provider to test consent, `store:false`, valid evidence and rejection of fabricated excerpts. No paid provider request was made.
- Generated desktop and mobile screenshots use synthetic records created through the real API. Visually reviewed; mobile document has no horizontal overflow. Recharts animations are disabled to keep screenshots/data stable.
- `npm audit` reports zero known vulnerabilities after dependency updates. This is a point-in-time report.
- Existing databases, S3 objects, Clerk credentials and production infrastructure were not changed.

Pending separate verification: Linux CI/container builds; live Clerk hosted sign-in; S3/IAM privacy and legacy-object downloads; managed PostgreSQL connection/migration rehearsal; SES delivery/permissions; approved real AI provider acceptance; hosting, backup and restore operations. Local Docker was not running, so container runtime behavior is not claimed as locally verified.
