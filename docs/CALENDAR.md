# Applications, Calendar and Overview review

This change is prepared on `Test/calendar-workflow`. Production migration and deployment require review first. No new paid service, notifications provider or background scheduler is required.

## Review locally

An existing local development database also needs the calendar migration before `npm run dev` can serve the new pages. First back up that local database and verify its migration history, then run `npm run db:migrate` and `npm run db:generate`. Restart development afterward. These commands use `server/.env`; confirm it points to your local database, never the hosted production database. Starting the development server does not apply migrations automatically.

Run `npm run preview:review`. This creates a disposable PostgreSQL database, verifies preservation and APIs, runs browser journeys, then keeps the synthetic workspace open at http://127.0.0.1:5179. It never reads the local DATABASE_URL. It uses a fixed browser-test identity on loopback only, not real Clerk login, private storage or paid AI. Stop with Ctrl+C to stop both servers and the temporary database. Do not expose these test servers to a public network.

Review these workflows in light/dark mode on desktop and mobile:

1. Applications: search `Review Fixture`, confirm ten rows per page, sort/filter and use Back/Forward. Review 30+ day Applied records, select a page, change pages and confirm selection clears. Only selected eligible records become Ghosted; the timeline and dashboard refresh.
2. Choose Schedule event on an application or its detail. Create a linked OA or Interview; the application stage stays unchanged unless the unchecked status box is selected.
3. Calendar: Today, previous/next month, day selection and day-specific Add event. Create an all-day deadline and a timed event with a named time zone. Edit, reschedule, complete and cancel.
4. Overview: create an event directly, inspect Upcoming events and Needs attention. Change analytics dates; the action cards stay independent. Completed/cancelled events leave both cards.

## Date and reminder rules

- Applied records qualify at `appliedDate <= server now - 30 * 24 hours`. No automatic Ghosted transitions occur. Mixed/stale stages are skipped; a batch containing another owner's or missing ID is rejected without partial updates.
- Timed events are stored as UTC instants with their IANA zone and displayed in the viewer's device zone. The editor uses the saved zone. Nonexistent spring-forward wall times are rejected; repeated fall-back hours should be verified after saving.
- All-day events retain their selected calendar date in the saved zone. Their reminder anchor is 09:00 there; they become overdue at the following local midnight, including 23/25-hour daylight-saving days.
- Reminder choices: 1 day (default), 1 hour, 15 minutes or None. None suppresses advance reminders, but unfinished past events still need attention. Dashboard cards refresh every minute while open and after changes. There is no email, push, browser permission or closed-app notification.
- Upcoming includes unfinished events through the inclusive seven-day boundary. An all-day event stays upcoming for its whole saved date. Needs attention includes overdue events and those whose reminder time has arrived. Cards show ten at a time; Calendar has a paginated Needs attention view and monthly Load more events.

## Data migration and compatibility

`20261027000000_calendar_events` extends the existing `Interview` table rather than replacing it. Existing IDs, timestamps, notes and application relationships remain. Ownership is backfilled from applications; old reminder leads are preserved, and interviews with no reminder keep None. The new application relationship is optional, allowing standalone events.

Active applications (anything except Offer, Reject or Ghosted) with a saved follow-up date receive one linked Other event with exactly that instant. Its deterministic ID is `legacy-follow-up:<application ID>`; migration retry cannot duplicate it. Existing follow-up fields and historical activities remain. Pending/processing/failed/uncertain follow-up jobs become cancelled; sent/previewed history is retained. New application/import/event writes create no delivery jobs, and the legacy worker never claims follow-up jobs.

`/api/events` is owner-scoped with required ISO timestamp bounds (maximum 370 days), pagination and optional application/category filters. `/api/events/:id` supports read/update. Old interview endpoints adapt linked Interview events to the new service. `/api/reminders` remains a legacy history endpoint; the delivery panel is removed from the UI.

## Release gate

1. Review the local preview before making production changes. Keep the feature branch local until Vercel Preview uses a separate database; its current build includes `prisma migrate deploy` and must not run against production as a side effect of a branch push.
2. Back up production and verify restoration into a staging database. Stop any legacy worker before migration so an already-claimed delivery cannot race cancellation.
3. Apply the new migration to the staging copy and compare application/resume/event IDs, relationships, dates, notes, counts and delivery history. Automated fixtures verify preservation and retry safety, but do not prove absence of production schema drift.
4. Configure separate preview API/frontend projects or isolated Preview credentials; API CORS must allow the preview origin. Keep storage/Clerk credentials isolated as appropriate. Review with real hosted authentication before production approval.
5. After approval, apply migration as a controlled release and deploy both API/frontend together. Verify ownership, event scheduling and manual Ghosted review with explicitly labeled synthetic records. Do not restart a legacy delivery worker for dashboard reminders.

Rollback retains the added columns/table and saved legacy fields. A previous API that assumes every Interview has an application cannot safely list standalone events; restore the last release only with a compatible API adapter or maintenance mode. Do not delete new events or reverse the migration automatically. Correct issues with a forward migration; restore backups only under a separately approved recovery plan.

Existing dependency security advisories remain separate work. No production or private-service acceptance is implied by local tests.
