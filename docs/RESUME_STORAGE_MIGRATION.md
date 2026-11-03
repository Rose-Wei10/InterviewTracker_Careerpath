# S3 to private Blob — manual review gate

No production data has been migrated. Existing S3 objects must remain until verified cutover and explicit cleanup approval. Keeping them may incur AWS charges.

## Inventory (read-only)

Run from the repository root:

```
npm run resumes:inventory -- --env-file server/.env
```

For hosted records, use a private environment file with the hosted DATABASE_URL and authorized S3 read configuration. Never paste its values into chat, commit it, or point test commands at that database. The command prints only total/Blob/eligible/error counts and aggregate bytes. Source errors include missing, unreadable and invalid PDFs; resolve them before apply. Dry-run makes no Blob or database writes. It does read S3 objects; ordinary provider read/egress usage applies.

Local read-only inventory on 2026-11-02: 1 referenced S3 PDF, readable, 34,798 bytes; zero Blob references and zero source errors. Hosted read-only SQL inventory: 1 resume, 1 Blob reference, 0 S3 references, 38,774 recorded bytes. No hosted S3 migration is needed at this snapshot. Vercel confirms the store is Private on Hobby: 38.8 kB stored; average storage 31.3 kB / 1 GB; simple operations 4 / 10,000; advanced operations 5 / 2,000; transfer 43.8 kB / 10 GB. These readings leave ample room for the 34,798-byte local file, but must be refreshed immediately before an approved copy. Unreferenced S3 bucket objects and unrelated AWS resources were not inventoried.

## Capacity and apply — only after review

Check the team's Hobby plan and Blob storage, operation and transfer usage. Free allowance is shared: subtract current usage and reserve headroom for verification reads, retries and normal traffic. Storage headroom alone does not prove operation/transfer capacity. If any allowance would be exceeded, stop; do not upgrade automatically.

Back up the selected database and rehearse restore. Run dry-run again. Freeze resume writes during cutover; compare-and-swap also protects changed references. The command requires a private manifest and an explicit reviewed free-byte budget:

```
npm run resumes:inventory -- --env-file /private/path/production.env --apply --capacity-reviewed --remaining-bytes REVIEWED_BYTES --manifest /private/path/resume-migration.jsonl
```

Replace REVIEWED_BYTES with the verified integer allowance. Default uploads now use Blob; configure BLOB_STORE_ID/OIDC or the authorized Blob token before releasing. RESUME_STORAGE_PROVIDER=s3 is an explicit temporary local/pre-cutover option, never an implicit fallback. Existing S3 reads/downloads/deletions retain compatibility. The ignored local development environment explicitly selects s3 until its copy is approved; after verified cutover, change that setting to blob. No secrets were changed.

Each destination is deterministic per resume/owner/original key. Copy is private and never overwrites an existing destination; readback must match size and SHA-256. The synced 0600 JSONL manifest records original key/URL, target and verification state before the conditional database update. IDs, relationships, dates, versions and report JSON are not changed. Retries skip Blob rows and reuse matching copied objects. Conflicts leave the current DB reference intact; errors stop the apply process. No S3 deletion occurs.

## Verification and rollback

Read database state alongside every manifest entry, including “verified” entries: a process can stop after the database update but before the “committed” journal entry. Validate migrated downloads and Match while signed in; unsigned private access must fail. Check all owners/references, not only the latest upload. Keep the manifest private and backed up.

To roll back, during a maintenance window restore each original fileKey/fileUrl from the manifest only if the row still points to that manifest's target. Verify the retained S3 original first. Never replace unrelated newer references or reset the whole database over new user data. Retain copied Blob objects until rollback review; remove neither provider's objects automatically.

Only after every required local/hosted record works through Blob should active AWS credentials be removed. Bucket deletion and AWS account closure require separate approval. Vercel Hobby is free within limits; reaching them may pause storage access. Recheck https://vercel.com/docs/vercel-blob/usage-and-pricing before apply.
