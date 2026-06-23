-- ============================================================================
-- Veda EMR -> Rivio Integration Foundation
-- Server-to-server invoice intake, Veda identifiers, idempotency, and webhooks.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Map each Veda organization to exactly one Rivio tenant.
create table if not exists public.veda_organization_mappings (
  veda_organization_id text primary key,
  display_name text not null default 'Veda EMR',
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  webhook_base_url text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.veda_organization_mappings
  add column if not exists display_name text not null default 'Veda EMR',
  add column if not exists webhook_base_url text,
  add column if not exists notes text,
  add column if not exists deleted_at timestamptz;

alter table public.veda_organization_mappings enable row level security;

drop policy if exists "Users read own Veda mappings" on public.veda_organization_mappings;
create policy "Users read own Veda mappings"
  on public.veda_organization_mappings for select
  using (auth.uid() = user_id);

create index if not exists idx_veda_organization_mappings_user_id
  on public.veda_organization_mappings(user_id);

-- Link Veda patients to Rivio clients.
create table if not exists public.veda_integration_customers (
  id uuid primary key default gen_random_uuid(),
  veda_organization_id text not null,
  veda_patient_id text not null,
  rivio_customer_id uuid references public.clients(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_name text not null,
  patient_email text,
  patient_phone text,
  patient_dob date,
  patient_address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (veda_organization_id, veda_patient_id)
);

alter table public.veda_integration_customers enable row level security;

drop policy if exists "Users access own Veda customers" on public.veda_integration_customers;
create policy "Users access own Veda customers"
  on public.veda_integration_customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_veda_integration_customers_user_id
  on public.veda_integration_customers(user_id);
create index if not exists idx_veda_integration_customers_client_id
  on public.veda_integration_customers(client_id);

-- Extend Rivio invoices with Veda source identifiers.
alter table public.invoices
  add column if not exists veda_organization_id text,
  add column if not exists veda_patient_id text,
  add column if not exists veda_invoice_id text,
  add column if not exists veda_metadata jsonb not null default '{}'::jsonb,
  add column if not exists paid_amount numeric(10,2) not null default 0,
  add column if not exists latest_payment_failure text,
  add column if not exists voided_at timestamptz,
  add column if not exists refunded_at timestamptz;

create unique index if not exists idx_invoices_veda_unique
  on public.invoices(veda_organization_id, veda_invoice_id)
  where veda_organization_id is not null and veda_invoice_id is not null;

create index if not exists idx_invoices_veda_patient
  on public.invoices(veda_organization_id, veda_patient_id);

-- Extend line items with source metadata from Veda.
alter table public.line_items
  add column if not exists veda_source_type text
    check (veda_source_type is null or veda_source_type in ('cash_visit','insurance_claim','custom')),
  add column if not exists veda_source_id text,
  add column if not exists veda_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_line_items_veda_source
  on public.line_items(veda_source_type, veda_source_id);

-- Contract-friendly alias for integration readers; the app continues to use line_items.
create or replace view public.invoice_lines as
select
  id,
  invoice_id,
  service as label,
  description,
  quantity,
  rate,
  amount,
  veda_source_type as source_type,
  veda_source_id as source_id,
  veda_metadata as metadata,
  created_at
from public.line_items;

-- Audit events sent to Veda.
create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.invoice_events enable row level security;

drop policy if exists "Users access own invoice events" on public.invoice_events;
create policy "Users access own invoice events"
  on public.invoice_events for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

create index if not exists idx_invoice_events_invoice_id
  on public.invoice_events(invoice_id);

-- Payment attempts capture payment metadata for Veda status reads and callbacks.
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  status text not null check (status in ('pending','succeeded','failed','refunded')),
  amount_cents integer not null default 0,
  payment_method text not null check (payment_method in ('card','debit','ach','bank_transfer','other')),
  payment_processor text,
  processor_payment_id text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_attempts enable row level security;

drop policy if exists "Users access own payment attempts" on public.payment_attempts;
create policy "Users access own payment attempts"
  on public.payment_attempts for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

create index if not exists idx_payment_attempts_invoice_id
  on public.payment_attempts(invoice_id);
create unique index if not exists idx_payment_attempts_processor_unique
  on public.payment_attempts(payment_processor, processor_payment_id)
  where payment_processor is not null and processor_payment_id is not null;

-- Idempotency cache for Veda write operations.
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(scope, key)
);

alter table public.idempotency_keys enable row level security;

-- Service-role API owns this table; no direct client policies needed.

-- Webhook delivery log and retry state.
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  invoice_id uuid references public.invoices(id) on delete cascade,
  destination_url text not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt_count integer not null default 0,
  response_status integer,
  response_body text,
  request_body jsonb not null default '{}'::jsonb,
  last_error text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webhook_deliveries enable row level security;

drop policy if exists "Users access own webhook deliveries" on public.webhook_deliveries;
create policy "Users access own webhook deliveries"
  on public.webhook_deliveries for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

create index if not exists idx_webhook_deliveries_invoice_id
  on public.webhook_deliveries(invoice_id);
create index if not exists idx_webhook_deliveries_retry
  on public.webhook_deliveries(status, next_retry_at)
  where status = 'failed';

drop trigger if exists update_veda_organization_mappings_updated_at on public.veda_organization_mappings;
create trigger update_veda_organization_mappings_updated_at
  before update on public.veda_organization_mappings
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_veda_integration_customers_updated_at on public.veda_integration_customers;
create trigger update_veda_integration_customers_updated_at
  before update on public.veda_integration_customers
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_payment_attempts_updated_at on public.payment_attempts;
create trigger update_payment_attempts_updated_at
  before update on public.payment_attempts
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_webhook_deliveries_updated_at on public.webhook_deliveries;
create trigger update_webhook_deliveries_updated_at
  before update on public.webhook_deliveries
  for each row execute function public.update_updated_at_column();
