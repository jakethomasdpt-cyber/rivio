# Rivio: Supabase to Neon

Rivio now uses PostgreSQL hosted on Neon and Better Auth running inside the existing Next.js app. Stripe, Resend, invoice portal tokens, Veda IDs, and the public application domain remain the same.

## Accounts and access

- Imported users retain their UUIDs, email addresses, verification status, and bcrypt password hashes. Better Auth verifies legacy bcrypt hashes; new passwords use its default scrypt hashing.
- Users must sign in again after cutover. Old Supabase sessions do not grant access to the new app.
- Browser code talks to the app's authentication and business endpoints. It has no direct database credentials or public database API.
- The deployed database connection uses `rivio_app`, a role without schema ownership, role administration, or access to `migration_archive`. Business routes enforce account ownership; signed Veda requests and invoice portal tokens retain their existing access rules.
- The private archive contains the original schema and every exported public/auth/storage table, including historical auth records. No customer data or secrets are stored in this repository.

## Configuration

See `.env.example`. Production requires `DATABASE_URL` for the restricted runtime role, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` set to the canonical application origin. Existing Stripe, Resend, and Veda environment variables are still required. `DATABASE_URL_UNPOOLED` is an owner connection for local migration tooling only; do not deploy it.

## Migration artifacts

- `database/001-auth.sql`: generated from the pinned Better Auth configuration.
- `database/002-business.sql`: captured from the live Rivio schema; user foreign keys reference the imported Better Auth user table.
- `database/003-workspace-trigger.sql`: atomically creates a workspace for each new account.
- `scripts/migrate-to-neon.mjs`: imports into an empty Neon target in one transaction, verifies every business record and password hash, and refuses to overwrite an existing installation.

The initial import contained one user, eight clients, sixteen invoices, twenty-seven line items, one workspace, and all associated event, idempotency, and Veda mapping/delivery records. There were no storage objects, bank records, mileage trips, or MFA factors in the source export.

Private source backups and the row verification report are stored outside the repository at `/Users/jakethomas/Projects/Backups/rivio-neon-20260911/`.

## Validation

Run `npm test` and `npm run build`. With a localhost server running against a non-production Neon environment, `node --env-file=.env.local scripts/verify-neon.mjs` creates and removes synthetic accounts to exercise legacy-password login, session cookies, workspace creation, invoice totals, client joins, account isolation, portal access, PDFs, duplication, logout, and archive access restrictions. It does not send an email or charge a card.

The optional `--keep-fixture` flag retains synthetic accounts for browser verification; remove these before promoting a database to production. Do not run synthetic tests on production after cutover.

## Cutover and recovery

`RIVIO_MAINTENANCE=1` returns an uncached 503 with Retry-After, including for payment webhooks, while the final source comparison is performed. Stripe can retry webhook deliveries during that interval. Normal deployments leave this unset or set it to `0`.

Before promotion, compare the final source export with Neon, including account IDs/password hashes and every business table. Retain the original Supabase project and private backups for recovery. Once Neon accepts real writes, never simply roll back to the stale Supabase database: first reconcile all new invoices, payments, and webhook events back to the recovery database. A code rollback that continues using Neon is preferable when possible.

## Completed cutover — September 11, 2026

The final source export matched Neon record-for-record across all 14 business tables: 8 clients, 16 invoices, 27 line items, 1 workspace, 53 timeline events, 18 invoice events, 22 idempotency records, 5 Veda customer mappings, 1 organization mapping, and 27 webhook deliveries. The remaining tables were empty. The existing account UUID, email, verification status, and password hash also matched. All synthetic test accounts and records were removed.

The complete final source snapshot is retained privately as `final-data.json`, with checksums in `final-verification.json`, and as snapshot 2 in Neon's restricted `migration_archive.source_snapshot`. The old Supabase project `rsgkhgogmlsumvcykwro` is paused, not deleted.

Validation included 14 passing unit tests, a production build, browser login and invoice display, PDF generation, account isolation, password reset/token reuse checks, session revocation, and a deployed signed Veda lookup confirming the original invoice amount and portal URL. Stripe and Resend credentials were checked with read-only provider requests; no real charge or test email was sent.

Vercel can mask sensitive values when exporting environment settings. Never use those placeholders as credentials or copy them into another deployment. Local environment files are excluded from deployment uploads through `.vercelignore`.
