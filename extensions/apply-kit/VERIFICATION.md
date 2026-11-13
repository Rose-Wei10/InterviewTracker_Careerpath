# Apply Kit side-panel verification · 2026-11-11

No real employer field was filled and no application was submitted during this update. All write tests used synthetic data in an isolated Chrome profile. No paid service or AI provider was added.

| Workflow / provider | Evidence | Remaining manual work |
| --- | --- | --- |
| Real unpacked extension | Imported synthetic bundle; all-frame scan; native select, text and iframe writes; verified 3 values; demographic excluded from bulk selection; close/reopen restored session; navigation required a new scan. Screens checked at 320 and 600px and dark theme. | Chrome controls panel resizing; site grants are explicit. |
| PayPal Eightfold | Read-only live inspection confirmed aria-controlled comboboxes, separate country-code field, checkbox demographic group with an aria-labelledby question, and legal consent checkboxes. Synthetic tests cover exact options, group isolation and delayed choices. | Live filling is not verified. Closed/inaccessible menus, date pickers and unsupported commitment signals require manual completion. |
| Greenhouse | Read-only Figma application inspection confirmed contact text inputs, custom comboboxes, textarea answers and upload input. Local real-Chrome multi-frame scan/fill succeeds with an explicit test-host grant. | Live cross-origin extension grant/fill is not verified. Missing listbox relationships or sandbox restrictions require manual completion / standalone application. |
| Ashby | After explicit approval, read-only inspection of Skydio confirmed an embedded jobs.ashbyhq.com application with contact inputs, uploads, checkbox availability choices and fieldset-grouped demographic radios. Synthetic iframe and choice tests cover the shared scanner. | Live extension filling is not verified; inaccessible options or frames remain manual. |
| Workday | Synthetic native / ARIA choice controls and repeated Yes/No groups. | Available live tab was a signed-in Candidate Home; automatic approval review blocked its broader account scope. A specific application URL is needed. No live fill claim. |
| iCIMS | Synthetic native / ARIA controls, delayed choices and stale-field handling. | No live iCIMS application URL was available. No live verification claim. |
| Uploads | Native filename and invalid state are tested, including a rejected synthetic file state. | Upload on employer form. Native FileList does not prove server acceptance; verify employer preview, errors and receipt manually. |
| Submission handoff | Explicit confirmation gate; company/role/location/date and original URL prefill Careerpath's existing duplicate-check/add/edit flow. | User must see an employer receipt, confirm it and save the Careerpath form. Exact-URL duplicate checks do not canonicalize URL variants. |

`npx vitest run extensions/apply-kit` covers exact options and explicit equivalents, dialing code versus postal/residence fields, stale/manual changes, replaced elements, invalid values, delayed/uncommitted autocomplete, uploads, review/bulk separation and session saves.

Custom controls must expose a stable accessible question and a uniquely matching option, and must expose a read-back commitment signal. The extension fails closed when those signals are missing. Multiple checkbox answers, closed shadow roots, inaccessible frames, virtualized options that never appear and upload server status remain manual. Completed entries reflect the last scan/fill read-back; rescan after editing the form.

Live inspection scope was later narrowed at the user’s request: Workday and iCIMS remain synthetic-only. Testing was stopped when requested; documentation updates do not imply another test run.

## November 12 observations and follow-up

The user reported a Viam Greenhouse run with 43 loaded answers, 13 detected fields, 11 matches and six contact/profile values filled and read back. Menus without exposed options remained in review. The user also reported successful receipts and Careerpath records for Viam, C3 AI, Netflix and DoorDash; Siemens remains pending user-created credentials. These are user-provided observations, not a new extension verification run. Complete scan/fill results were not established for the other providers merely by invoking Scan.

v2.1 adds targeted menu retries, keyboard menu inspection, explicit GPA brackets, application-only overrides, clearer upload diagnostics and observed LinkedIn-link retention. Eightfold requires an exposed committed selection after blur; translated wording must be chosen explicitly. Missing graduation options and narrower identity choices remain in review rather than being inferred. The new regression cases and live-provider behavior have **not been executed or reverified** because testing remains paused. No application records, credentials, uploads or employer forms were changed as part of this follow-up.
