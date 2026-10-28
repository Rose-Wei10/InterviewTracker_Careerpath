# Security and privacy operations

## Boundaries

Clerk verifies API requests; the API derives ownership from the verified identity, never from request bodies. Mutations allowlist fields with strict Zod objects and include owner predicates. Non-owned records return 404. All `/api` responses are marked no-store. Clerk's [Express middleware documentation](https://clerk.com/docs/reference/express/clerk-middleware) explains authorized-party validation. Live hosted login still needs a staging verification pass.

Environment values are validated at startup without logging their contents. The application no longer logs auth objects or private records. Secrets pasted into chat or previously printed by the server must be rotated externally. Git history and existing service logs require separate review; deleting a source log statement does not revoke a credential or erase old logs.

API limits: 1 MB JSON, bounded pagination/export/import, 5 MB/one-file PDF uploads, global 120 requests/minute per IP, analysis 3/minute per user plus 10 attempts per rolling day. The global and burst stores are in-memory; daily usage and background claims are durable in PostgreSQL. Default CORS allows only the configured frontend origin. The backend does not fetch application job URLs, avoiding a user-controlled server fetch.

## Resume storage

Authenticated uploads use PDF MIME/signature checks, random opaque names under an owner prefix and S3 encryption. Signature checks do not constitute malware scanning. Text extraction runs in a bounded worker thread with a timeout, page cap and output cap. Downloads are owner-checked and signed for 60 seconds; anyone possessing the temporary URL can use it until expiration, so do not share it publicly. Public bucket policy/ACLs must be audited separately.

Existing `fileKey`/`fileUrl` fields remain for data preservation. Legacy public URLs are not used by the frontend and are not returned in list responses. Making old objects private is an external AWS operation requiring review/approval; code cannot retroactively revoke a public link while the bucket allows access.

S3 and PostgreSQL cannot share a transaction. Upload compensates a DB failure by deleting the new object. A failed compensation logs a generic reconciliation signal. Delete removes the S3 object first, then the DB record; an S3 error retains the record for retry. A DB failure after successful S3 deletion can temporarily leave a stale row; retrying is safe because S3 DeleteObject is idempotent. Periodic S3 inventory reconciliation is a future operational improvement. Versioned buckets retain deleted versions unless a lifecycle policy removes them; document retention expectations accordingly.

## Analysis privacy

Free resume reviews never call an AI provider, including when legacy AI environment variables are present. PDF and pasted resume text are processed in memory, not saved as a raw-text column. Job descriptions, report evidence excerpts and bullet prompts are stored in owner-scoped history and may contain personal information. Text previews require authentication and return `Cache-Control: no-store`. Deleting a PDF still cascades its associated reports; text-only reports have no PDF dependency. Removing a linked application clears the report link while keeping its job-description snapshot.

Keyword matches demonstrate mentions, not proficiency. Experience duration and seniority require manual judgment. Editing prompts never generate achievements or metrics. Three review requests per minute and a serialized rolling daily allowance protect the backend; failed attempts do not consume that allowance. Interrupted processing attempts are marked failed when the next review starts after five minutes. Raw request bodies, credentials and private provider errors are not logged. Test-only identity/storage/rate-limit adapters run only with NODE_ENV=test and a disposable test database; they must never be deployed.

Before a public deployment, define a retention policy, account deletion workflow, privacy notice and provider disclosures. Account deletion and automatic retention are not implemented. Restrict a portfolio demo to synthetic data until those operations are in place.

## Reminder privacy and reliability

Messages are sent only to the user's verified primary Clerk email and contain minimal reminder information, without resume text or notes. SES credentials come from the worker's SDK credential chain. Console mode logs no email addresses/content and marks jobs previewed. In-flight uncertainty is surfaced for manual reconciliation; no claim of exactly-once delivery is made.

## Reporting issues

Do not open public issues containing secrets, tokens, private PDFs or job-search records. Notify the repository owner privately using an established contact channel. Dependency audits are point-in-time checks, not a guarantee that the application is vulnerability-free.
