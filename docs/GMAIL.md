# Gmail job email review

Careerpath uses its existing Clerk login and a separate Google OAuth connection. Create a Gmail label named **Careerpath**, apply it to recruiting messages, then open **Overview → Email updates**. Connect Gmail and click **Finish connecting Gmail** after returning from Google. **Sync now** checks the last 30 days of labeled messages, importing up to 100 new messages at a time.

The queue stores sender, subject, received date and review metadata. Google grants read-only access to the whole mailbox, and Careerpath limits import to the label. Application links, status changes and calendar events require separate user actions. Disconnecting revokes Google access and retains review history and message IDs so a later reconnect can skip duplicates.

## Setup for a private preview

1. Create a Google Cloud OAuth web client, enable the Gmail API, and configure the OAuth consent screen. For external Testing mode, add your Gmail address as a test user. Google can expire Gmail refresh tokens after seven days in this mode.
2. Add the exact frontend URL ending in `/email-updates` as an authorized redirect URI. Use the local frontend URL for local testing and the selected preview URL for a hosted preview.
3. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` and `GMAIL_ENCRYPTION_KEY` in the backend environment. Generate the key with `openssl rand -hex 32` and store the result as a secret. Changing it invalidates stored connections. Keep the key stable between deployments.
4. Apply the additive Prisma migration to the preview database, then deploy the API and frontend. Verify a labeled synthetic email, an unlabeled control, a timeline entry, and the existing event form before connecting real recruiting mail.

Gmail read-only is a restricted scope. Review Google's [verification exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) before a hosted rollout and confirm eligibility for personal use before enabling it. The integration needs no AWS service or background worker.
