# Intelligent Clinic / Veda invoice branding

## Behavior

Rivio resolves `vedaOrganizationId` through its existing organization mapping. The mapping's new `organization_name` is the public provider name; when absent, Rivio uses the mapped workspace's `business_name`. The integration connection's `display_name` (often “Veda EMR”) is never a provider name. There is no global Physical Therapy 365 provider default. The existing PT365 workspace authorization gate remains unchanged.

Both signed invoice creation (`POST /api/veda/invoices`) and manual card charge (`POST /api/veda/payments/charge`) store this provider on new line items. Newly created integration invoices use `INTYYMM-#####`, with the same local-date components and random five-digit suffix as before. The database's existing unique constraint remains authoritative; number collisions are retried up to ten times. Other constraint failures are not retried.

Existing invoice numbers are never rewritten. Existing-invoice responses and idempotency replays return the original invoice number. Rivio still generates and returns `invoiceNumber`; the EMR must store that returned value, without reconstructing or replacing the prefix.

## EMR API change

No change is required if the Rivio workspace business name is already the desired public name. To explicitly display “Physical Therapy 365” when the workspace has a different legal name, add this optional top-level JSON field to both creation request types above:

```json
{
  "vedaOrganizationId": "<the existing organization ID>",
  "vedaOrganizationName": "Physical Therapy 365"
}
```

This fragment extends the existing request; all existing patient, invoice, line, and payment fields remain required as before. Source the name from the originating EMR organization's configuration, not a global constant. Include the field in the exact JSON bytes signed by the existing HMAC scheme. No invoice-prefix field is needed or accepted as an override; INT is Rivio's integration numbering policy.

The name must be a nonblank string, at most 200 characters after trimming, with no control characters. Invalid supplied values receive HTTP 400. Omission preserves the previously saved name; null/blank do not clear it. A supplied name is persisted only for the authenticated, active organization mapping and its owner. It also controls subsequent rendering of that organization's older invoices. Idempotency-cache replays do not update the name; send it on a fresh request or configure it through the settings endpoint below.

## Rollout and existing invoices

1. Apply `database/004-integration-branding.sql` before releasing the application. This adds one nullable mapping column; it does not modify invoice numbers or stored line items.
2. Set the public name for this customer's existing mapping to `Physical Therapy 365`. An authenticated owner can use the existing `PATCH /api/settings/integrations/veda` endpoint with the same two-field JSON fragment above. POST mapping setup also accepts the field; GET returns it as `organization_name`. Alternatively, the first new signed EMR creation request containing `vedaOrganizationName` saves it. This is organization-specific configuration, not a global data migration.
3. Release the application changes after verification and approval.

The hosted invoice and payment portal, newly generated Stripe checkout sessions, regenerated PDFs, newly sent invoice/reminder emails, and new payment-confirmation receipts resolve the name at read/send time. Thus existing VEDA-numbered invoices pick up the corrected name once the mapping is configured, including invoices whose integration has since been deactivated. Mapping lookup is scoped by organization ID and invoice owner. Non-integration invoices retain their original line providers and workspace branding.

Emails and receipts already delivered, PDFs already downloaded, and Stripe checkout sessions already created are external snapshots and cannot change retroactively. Create a new checkout session from the hosted portal to receive updated line descriptions. Stripe's account-level merchant branding and automatic Stripe receipts remain governed by Stripe account settings; these changes control Rivio's provider descriptions and Rivio-generated receipts. Sender email addresses and reply-to settings are unchanged.

## Verification

`npm test` covers organization-name validation, organization/owner lookup scoping, two distinct organizations, legacy workspace fallback, unchanged native invoices and issued numbers, omission semantics, number format, database collision retries, duplicate-source failures, retry exhaustion, and route wiring across all customer-facing surfaces. `npx tsc --noEmit` checks route integration types. All 21 tests, TypeScript checking, and `npm run build` passed.

No migration, live payment, customer email, push, or deployment was performed while implementing this change. Tests use synthetic data and the real SQL query adapter with a controlled executor; they do not claim live Stripe/Resend or production database verification.

## Production migration — September 17, 2026

Applied migration 004 to the production Neon database and configured the existing Physical Therapy 365 organization mapping with public name `Physical Therapy 365`. The update was scoped to that mapping and its owner. All 16 issued invoice IDs and invoice numbers were verified unchanged in the migration transaction. A private pre-migration snapshot is retained outside version control.
