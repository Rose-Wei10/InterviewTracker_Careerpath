# Free job-specific resume review

Prepared on `Test/free-resume-review`. No AI provider, paid plan, production migration or production deployment is part of this implementation.

## What to review

Run `npm run preview:review` to create a disposable PostgreSQL database, verify preservation/API/browser tests and leave the synthetic app at http://127.0.0.1:5179/analysis. The preview uses test authentication and a private temporary filesystem for synthetic PDFs; neither S3 nor Blob is contacted. These adapters are confined to the test server and must never be deployed.

- **Resumes:** upload a text-based PDF, choose Review for a job, and preview extracted text. Upload/download failures should explain what to retry. The pasted-text path works without PDF storage.
- **Match:** choose PDF or pasted text, optionally select an application, and supply a job description. Find requirements, edit/remove detected items and add custom ones. Choose Manual review for experience, seniority or other semantic requirements.
- **Report:** see exact evidence, missing mentions, manual checks and prompts about existing bullets. Counts describe selected keyword mentions; there is no ATS score or assessment when no keyword checks are selected. Print report uses browser printing. Reports are snapshots; changing inputs warns that a displayed report belongs to previous inputs.
- **Applications:** save/reuse the job description, start a review with the chosen resume and open linked reports. Reports do not automatically change the application's selected resume or status.
- **History:** completed, processing and failed states remain distinct. Previous demo/AI reports stay readable as historical reports. Deleting a PDF still deletes its reports, as before; deleting an application clears its report links without deleting the job snapshots.

This is a rule-based review, not semantic AI or a resume-writing service. Common technical aliases and a small set of nontechnical terms are recognized; custom terms support other roles. A mention is not proof of competence, and an unmatched keyword is not proof of absent ability. Negated mentions are conservatively excluded. Manual checks do not contribute to the keyword count.

## Interfaces and privacy

- `POST /api/analyses/requirements`: `{jobDescription}` → at most 50 `{term,kind}` suggestions. `kind` is `keyword` or `manual`.
- `GET /api/resumes/:id/text`: owned PDF → `{text,pages,truncated}` with no caching. Text-based PDFs only; encrypted/scanned/unreadable files offer pasted text as the fallback. Parsing stays in the bounded worker (10 seconds, 20 pages, 40,000 characters). Limits are disclosed rather than silently scoring omitted content.
- `POST /api/analyses`: exactly one of `resumeId` or `resumeText`; `jobDescription`; optional owned `applicationId`; optional `requirements` (maximum 50, term maximum 200 characters). If omitted, requirements are detected automatically; an explicit empty list yields no keyword assessment. The legacy `consent` field is accepted but unused. No AI call is possible.
- `GET /api/analyses`: owned history, newest 50, optionally filtered by applicationId. `GET /api/analyses/:id` and DELETE remain owner scoped. `/config` returns `{mode:"rules",dailyLimit:10}`.
- Pasted text must contain 20–40,000 characters; job descriptions require 50–20,000. Raw resume text is not stored or autosaved. Reports retain excerpts, bullet originals/prompts and the job-description snapshot. Invalid inputs produce no report; PDF failures retain a failed attempt when possible.
- Pending/completed attempts within 24 hours count toward the ten-review allowance. Failed attempts do not; reservations are serialized per user. After five minutes, the next review marks interrupted pending attempts failed. Per-user review throttling remains three/minute. The browser-test server has a guarded test-only global burst allowance for its many automated journeys; production remains at 120 requests/minute.

## Database and rollout

`20261028000000_free_resume_review` adds application job descriptions and optional Analysis.applicationId, makes Analysis.resumeId nullable, and adds status/failureReason. It retains the original report JSON and backfills completed/failed states from the existing result field. Reapplying the SQL is safe. No PDF object is renamed or rewritten. Version-two result JSON contains the selected checks, exact quotes, counts, prompts and extraction warnings; the frontend separately renders legacy results.

Your localhost development database was backed up, restored into disposable PostgreSQL and rehearsed before the migration was applied locally. Original user/application/resume/report/activity/event/reminder fields were compared and preserved. Backups live in the ignored, private `.local-backups/` directory. Future existing databases must be backed up and rehearsed before running `npm run db:migrate`; generate Prisma and restart `npm run dev` afterward. No automatic migration is added to development startup.

Before release:

1. Review the local preview. Do not push this branch while Vercel Preview shares the production database: backend builds run `prisma migrate deploy`.
2. Back up production, restore it to staging and rehearse the migration. Compare existing records, report snapshots and private file keys. Verify restore capability and schema history.
3. Verify hosted Clerk login, S3/Blob upload/read/extraction/download permissions using separately labeled synthetic fixtures on the approved staging configuration. Existing deployed-storage acceptance does not prove the new release's environment is correctly configured. No live storage write or paid service was performed during local verification.
4. Obtain production migration/deployment approval, then coordinate API/frontend release and request a browser refresh. The previous frontend expects the legacy result shape; do not advertise compatibility with clients left open across the release.

Rollback must preserve added columns and new text-only reports. The old frontend assumes every report has a PDF and cannot safely show the new result format. Prefer a forward correction or maintenance mode; do not delete reports or reverse the migration automatically.

## Validation

`npm run check` covers lint, types, unit/component/PDF tests and both production builds. `npm run test:full` adds fresh migrations, migration retry/preservation/schema-consistency checks, real PostgreSQL API tests and desktop/mobile Chromium journeys. Tests cover aliases and punctuation, custom/manual terms, exact excerpts, truthful bullet prompts, PDF/text failures, owner isolation, concurrent daily limits, interrupted attempts, job snapshots, history, mobile layout and existing application/calendar workflows. Browser PDF tests use actual upload/extraction with temporary sandbox storage, not hosted S3/Blob.

Not yet verified for release: hosted storage/login, production-copy rehearsal, production load or physical devices/Safari/Firefox. Existing dependency advisories remain separate work.
