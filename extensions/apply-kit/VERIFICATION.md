# Apply Kit v2.2 verification

Testing resumed with explicit user authorization to finish, merge and push. All write journeys use synthetic answers and a disposable database or isolated Chrome profile. No real employer application was filled/submitted, and no mailbox setting or existing application record was changed during this verification.

## Completed checks

- ESLint and client/server/script TypeScript checks passed.
- Unit/component suite: 65 tests passed, including sender-filter query validation, frame deadlines/partial success/cancellation, safe direct links, open/closed shadow roots, delayed controls, manual legal controls, dates/seasons, work-history warnings and application-only overrides.
- Disposable PostgreSQL: 30 integration tests passed, including receipt ownership, transactional rollback, concurrent deduplication, rejection of unconfirmed evidence and unchanged application status. Migration-preservation checks passed. No new migration is required by v2.2.
- Playwright: 17 browser journeys passed, including a confirmed-receipt handoff, fragment removal, explicit confirmation, duplicate lookup and saved timeline readback, plus mobile/tablet/desktop and both themes.
- Real unpacked extension in an isolated Chrome profile: import, two-document scan, native choices/text, approved fill/read-back, demographic bulk exclusion, close/reopen and navigation passed. Layout checked at 320px and 600px and dark theme.
- Expanded recovery fixture: open shadow field, delayed location choices, ISO date filling, explicit graduation-season review, work-history warnings, changed-frame prompt/rescan, manual legal acknowledgment, submission-in-progress gate and confirmed receipt handoff passed.

The expanded journey caught a general Start date answer being offered for an employment-history start date. The matcher now uses fieldset context to keep availability separate from parsed work-history dates. A regression covers both contexts. The evidence test cleanup was corrected to remove synthetic applications before their users.

The extension browser check adds local HTTP host access only to a temporary test copy; shipped permissions remain active-tab plus optional explicit iframe grants. It tests the real extension panel document; it does not claim complete automation of Chrome’s native side-panel resizing UI.

## Provider evidence and limits

| Provider | Existing evidence | Remaining manual / unverified behavior |
| --- | --- | --- |
| PayPal / Netflix Eightfold | Prior read-only inspection and user observations establish custom comboboxes and translated choices. Synthetic tests cover displayed options and strict post-blur commitment. | Current live filling is not verified. Missing commitment signals and inaccessible/virtualized choices fail into review. |
| Greenhouse | Prior Figma inspection and user-reported Viam receipt; synthetic multi-document scanning and filling passed. | Live cross-origin extension grants/filling are not reverified. Sandbox restrictions and inaccessible option lists remain manual. |
| Ashby | Prior approved Skydio wrapper/embedded-form metadata inspection; synthetic iframe and grouped controls covered. | No new live filling claim. |
| Workday | Synthetic native/ARIA controls, search commitment and native-date behavior. | No specific live application was verified; segmented/custom date controls remain manual. |
| iCIMS | Shared synthetic native/ARIA control coverage. | No live provider application was verified. |

A selected filename does not prove upload-server acceptance. Verify the employer’s preview/errors. Closed shadow roots, native-accessibility-only widgets and multiple checkbox answers remain manual. Seasonal graduation mappings require explicit employer month definitions and matching years; no graduation or eligibility date is invented. Completed means the last successful read-back, not a submission receipt.

Original links can be retained only if observed or explicitly provided; URL variants can still evade exact-link duplicate lookup. Receipt excerpts are user-confirmed text, not cryptographically verified employer receipts. Hosted CI/deployment status is checked separately after pushing and is not implied by local success.
