-- Supabase PostgreSQL Schema for PT365 Invoice App
-- Production-quality schema with RLS, indexes, and triggers

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.clients enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.clients
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
create table public.invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number text not null unique,
  client_id uuid references public.clients(id) on delete restrict,
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','viewed','paid','overdue','cancelled')),
  payment_method text check (payment_method in ('stripe','venmo','zelle','other')),
  due_date date not null,
  paid_date date,
  notes text,
  internal_notes text,
  portal_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  reminder_enabled boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  sent_at timestamptz,
  viewed_at timestamptz
);

-- Enable RLS
alter table public.invoices enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.invoices
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- LINE_ITEMS TABLE
-- ============================================================================
create table public.line_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  service text not null,
  description text,
  service_date date,
  provider text not null,
  rate numeric(10,2) not null,
  quantity numeric(8,2) not null default 1,
  amount numeric(10,2) not null,
  sort_order integer default 0,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.line_items enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.line_items
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- TIMELINE_EVENTS TABLE
-- ============================================================================
create table public.timeline_events (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  event_type text not null check (event_type in ('created','sent','viewed','paid','reminder_sent','overdue','cancelled')),
  description text not null,
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.timeline_events enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.timeline_events
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- BANK_STATEMENTS TABLE
-- ============================================================================
create table public.bank_statements (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  file_url text,
  file_type text not null check (file_type in ('pdf','csv')),
  parsed boolean default false,
  upload_date timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.bank_statements enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.bank_statements
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- BANK_TRANSACTIONS TABLE
-- ============================================================================
create table public.bank_transactions (
  id uuid default gen_random_uuid() primary key,
  statement_id uuid references public.bank_statements(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('credit','debit')),
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  category text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.bank_transactions enable row level security;

-- RLS Policy: Allow authenticated users full access
create policy "Allow authenticated users full access"
  on public.bank_transactions
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to clients table
create trigger update_clients_updated_at
  before update on public.clients
  for each row
  execute function public.update_updated_at_column();

-- Apply trigger to invoices table
create trigger update_invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.update_updated_at_column();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Invoices indexes
create index idx_invoices_client_id on public.invoices(client_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_portal_token on public.invoices(portal_token);
create index idx_invoices_stripe_payment_intent_id on public.invoices(stripe_payment_intent_id);

-- Line items indexes
create index idx_line_items_invoice_id on public.line_items(invoice_id);

-- Timeline events indexes
create index idx_timeline_events_invoice_id on public.timeline_events(invoice_id);

-- Bank transactions indexes
create index idx_bank_transactions_statement_id on public.bank_transactions(statement_id);
create index idx_bank_transactions_matched_invoice_id on public.bank_transactions(matched_invoice_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Invoices with client details
create or replace view invoices_with_clients as
  select
    i.*,
    c.name as client_name,
    c.email as client_email,
    c.phone as client_phone,
    c.address as client_address,
    c.city as client_city,
    c.state as client_state,
    c.zip as client_zip
  from invoices i
  left join clients c on c.id = i.client_id;

-- Enable RLS on view
alter view invoices_with_clients set (security_barrier = on);
