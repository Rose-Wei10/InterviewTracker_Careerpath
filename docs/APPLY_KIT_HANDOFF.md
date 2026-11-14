# Apply Kit recovery + Gmail guidance — paused November 13, 2026

Branch: `Test/apply-kit-recovery-email-guidance`. Changes are uncommitted. Nothing pushed, deployed, migrated or submitted. No existing application records, mailbox settings or credentials changed. User requested wrap-up and will explicitly resume later; no automatic restart is scheduled.

## Implemented drafts (not validated)

- GmailLabelGuide: exact-sender and sender-plus-recruiting-phrases filter recipes, Copy search, connected-account context, manual Gmail setup steps, 30-day import explanation. OAuth/classifier unchanged.
- scan.mjs: lightweight frame discovery, two concurrent document scans, 10-second document / 30-second overall budget, partial results and per-frame progress, safe detected Greenhouse/Ashby direct-form URLs.
- panel: generation guards, cancellation injection, progress rendering, topic sections within the three status groups, direct-form links, changed-form polling, manual shadow/date guidance.
- controls: open shadow-root traversal and local-root label resolution, cooperative menu deadlines/cancellation, legal-acknowledgment exclusion, structured employment duplicate/missing/current-date warnings.
- matching: strict native ISO dates; explicit employer season-definition mapping with individual review; exact saved graduation remains unchanged.
- receipt handoff: separate submission state, user confirmation, bounded excerpt and source URL in URL fragment; Careerpath form requires confirmation again. API create/update accepts optional evidence, checks email ownership, writes activity transactionally and deduplicates within an application using a row lock. ActivityFeed exposes stored evidence. No new database table.

## Resume here

1. Static review first. The current drafts have only been formatted, not typechecked or run. Review generation/cancellation races, canceled document loops, overall deadline behavior, frame-discovery hangs, stale results and partial-result reporting. Ensure a new scan actively cancels previous injected work and single-field retry is bounded/cancellable too.
2. Check the shadow traversal carefully: parent traversal/labels/visible controls across roots, new shadow-root discovery, nested frame permissions, MutationObserver revisions and polling after single-field retries. Closed/native-AX-only widgets must remain manual.
3. Review direct-form allowlist coverage and original URL inheritance. A standalone tab opened by the panel may have the extension as opener; explicitly preserve the original job URL for the actual newly created tab, rather than relying only on opener inheritance.
4. Audit committed-value handling for school/location/search controls and segmented dates. Confirm native dates round-trip correctly; custom segmented fields must not receive ordinary text filling. Check employer season definitions beyond the current `Spring: Jan–March` / `Spring (Jan–March)` syntax; do not invent definitions or eligibility dates.
5. Review parsed employment grouping to avoid warnings from broad outer fieldsets or education groups. Confirm no structured fields are changed automatically.
6. Audit receipt flow end to end: user confirmation cannot be bypassed by selecting a display state, URL fragments are bounded and cleared appropriately, drafts survive save failure, source URL/email ownership validation works, duplicate evidence races are handled, evidence-only saves never change application status. Check detail timeline as well as dashboard ActivityFeed. Existing Applied default remains an explicit form save, not an automatic submission-state change.
7. Collapse lengthy explanations, ensure topic headings/counts remain correct, preserve focus after rerenders and prevent stale approvals during scans/retries. Add visible guidance when no LinkedIn origin was observed.
8. Add regression coverage for all new behaviors. Existing extension mocks need adapting: frame discovery now precedes per-document scans, new DOM IDs/submission controls and observer APIs exist, and the panel groups cards by topic. Add Gmail guide tests for invalid senders/query injection, receipts' cross-owner/rollback/dedup cases, frame timeouts/partial success/navigation, shadow roots, delayed iframe, legal exclusions, dates/seasons and employment warnings.
9. Finish both READMEs and provider verification notes. docs/GMAIL.md is updated; main README, extension README and VERIFICATION.md still need this iteration. Add an honest changelog/version and document optional permissions and paused verification.
10. Testing remains paused until the user explicitly requests it again. Then focused tests → lint/typechecks/builds → disposable DB integration → isolated extension/browser journeys. Prepare synthetic preview before production. Do not reload the unverified extension into live employer applications or alter the five confirmed / three pending records.

## Important limits

The approved plan is not complete and these drafts are not release-ready. No checks or tests were run during this iteration. Previous successful test results predate these changes and do not validate them. The user chose Gmail label setup as the first email priority, with minimal receipt text references; no broader mailbox scanning, sending, automatic sync or classifier rewrite is authorized in this release.

## Resumed implementation update

The source work described above has continued. Run-scoped cancellation, bounded single-field retries, direct-form tab-ID link retention, shadow-root visibility/labels, manual-only legal and segmented-date controls, native ISO date matching, explicit season mapping, narrower employment groups, submission evidence handoff/API/timeline and Gmail guidance are implemented. Receipt fragments are removed after parsing and the Careerpath form requires confirmation again. Added scanner, control, Gmail-guide and disposable-database evidence regression cases; adapted the panel mock for frame discovery. Both READMEs and provider notes now describe v2.2. A synthetic recovery preview source is at `extensions/apply-kit/fixtures/recovery.html`.

No test, typecheck, lint, build, database/browser journey, extension reload or live employer interaction was performed during this iteration. Changes remain uncommitted on the requested branch. Next required step is verification when the user explicitly resumes testing: focused extension/component tests, lint/typechecks/builds, disposable DB integration, isolated real-extension preview and browser journeys. Fix any resulting failures before committing or proposing production deployment. Earlier success counts do not apply to this update. Never use this unverified build on a real application as proof of provider support.
