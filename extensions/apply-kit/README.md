# Careerpath Apply Kit · Chrome side panel

Load this folder with **Load unpacked** on `chrome://extensions` (Chrome 116+). After an update, click **Reload** there. Click the extension icon → **Open side panel**. Resize the panel using Chrome’s divider.

Copy autofill data from Careerpath’s Apply Kit, paste it into the panel, then **Scan / retry** on the employer tab. Scan, bulk selection, counts and Fill selected remain visible while the suggestions scroll.

- **Ready to fill:** a clear saved-answer match and, for choice controls, one exact available option. Select individually or use **Select all ready fields**.
- **Needs review:** missing/ambiguous answers, closed menus without exposed options, demographics, consent, conflicts and eligibility. Review the proposed value, source and exact option. Demographics always require individual selection; no answer is inferred from other profile details.
- **Completed:** a value was read back and validated. Existing values are preserved. Failed writes stay in review with a rescan/retry action.

Native selects, radio/checkbox groups and accessible custom comboboxes are supported. Scan briefly opens empty custom menus to read their available choices, then sends Escape. If the menu does not expose choices, open it on the employer page and rescan. No option is selected during scanning. Delayed choices are awaited when filling. Autocomplete is incomplete unless a matching option is clicked and a committed selection is observed. Controls that don’t expose a reliable question, option list or committed state need manual input. Copy proposed answers as a fallback. Multiple checkbox answers must be reviewed on the form.

**Embedded applications:** Scan includes permitted frames. **Allow access to embedded application** requests permission for the visible iframe origins. Cross-origin Greenhouse/Ashby frames need this explicit grant; inaccessible/sandboxed frames remain manual. The extension does not bypass browser restrictions, logins or CAPTCHAs. Optional site grants persist in Chrome until removed through the extension’s site-access settings.

**Résumé:** uploads stay on the employer form. The panel shows the native file input’s selected filename and validation state, when exposed. A selected file is not proof of successful server upload; check the employer’s filename, preview/receipt and error messages. Use the separate manual reminders. They never count toward autofill selections.

**Progress/privacy:** answers, per-tab/page reviews and reminders stay in `chrome.storage.session` across panel closes and page switches, and clear when Chrome ends the session or **Forget saved session** is clicked. They are not synced or written to extension local storage. The clipboard can still contain your export. Only explicitly approved answers are written to an employer page. Rescanning never overwrites manually entered values. Selections reset after a rescan; document identity and original values are checked again before filling.

**After submission:** a Submit click is only an attempt. After an employer receipt/confirmation, confirm that in the panel and enter company, role, location, applied date and the original URL. Careerpath checks that exact URL for duplicates before offering its existing add/edit form. Review and save there; URL variants can still require a manual duplicate check. Metadata prefill requires the updated Careerpath frontend; the extension does not deploy it automatically.

## Verification

- `npx vitest run extensions/apply-kit`: matching, isolated Yes/No groups, demographic review, stale/manual edits, delayed and uncommitted choices, rejected values, frame/upload diagnostics and panel actions.
- `node extensions/apply-kit/browser-check.mjs`: real unpacked extension in an isolated Chrome profile, synthetic multi-frame application, native choice fill/read-back, review exclusions, session restore, navigation, narrow/wide layout and dark theme. Test-only local-host permissions are added to a temporary copy; no employer receives data.

Live preview inspection is distinct from successful live autofill. See `VERIFICATION.md` for the current provider coverage and limitations. No application is submitted by the extension.
