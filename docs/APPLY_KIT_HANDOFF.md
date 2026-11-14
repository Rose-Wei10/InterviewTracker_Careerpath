# Apply Kit recovery + Gmail guidance — release handoff

Branch: `Test/apply-kit-recovery-email-guidance`.

The user explicitly resumed verification and authorized merging/pushing to main after completion. The previously paused source implementation is now checked with unit/component tests, lint/typechecks/builds, disposable PostgreSQL integration, Playwright journeys and an isolated real-Chrome extension journey. No real employer submission, mailbox mutation or production-data change was used for testing.

## Final behavior

- Two-worker frame scans with per-document/overall budgets, progress, partial results, run-scoped cancellation and bounded field retries.
- Open shadow-root controls, changed-form prompts, exact-host standalone application links and tab-ID original-link inheritance; inaccessible controls remain manual.
- Status/topic groups, manual legal acknowledgments/segmented dates, valid native ISO dates, explicit employer graduation-season definitions and structured résumé-fragment warnings.
- Availability dates do not automatically match employment-history dates. Overrides remain application-only.
- Separate submission state, explicit receipt confirmation, bounded fragment handoff, confirmation again in Careerpath, owner-scoped transactional activity and deduplicated evidence without automatic status changes.
- Exact-sender Gmail filter guidance, with copied search and user-controlled setup. Existing classifier, read-only scope, manual sync and label/30-day boundary remain unchanged.

## Verification and release

See `extensions/apply-kit/VERIFICATION.md` for coverage and live-provider limitations. `extensions/apply-kit/browser-check.mjs` exercises only synthetic local forms in a disposable extension profile. `fixtures/recovery.html` is the synthetic recovery preview source. No new database migration is needed.

After release, reload the local unpacked extension in Chrome to load v2.2; a Git push cannot update an unpacked extension automatically. Git-connected hosting may redeploy the frontend/backend from main. Verify hosted deployment separately; do not equate a successful push with a successful deployment.
