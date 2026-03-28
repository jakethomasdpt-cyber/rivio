-- ============================================================================
-- RIVIO MULTI-TENANT MIGRATION
-- Run this in Supabase SQL Editor to upgrade from single-user to multi-tenant
-- ============================================================================

-- ============================================================================
-- 1. WORKSPACES TABLE (one per user account)
-- ============================================================================
create table if not exists public.workspaces (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  business_name text not null default 'My Business',
  owner_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  website text,
  logo_url text,
  brand_color text default '#004a99',
  venmo_handle text,
  zelle_phone text,
  stripe_account_id text,
  invoice_prefix text default 'INV',
  invoice_footer text,
  tax_rate_default numeric(5,2) default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.workspaces enable row level security;

drop policy if exists "Users manage own workspace" on public.workspaces;
create policy "Users manage own workspace"
  on public.workspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: auto-create workspace on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.workspaces (user_id, business_name, email, owner_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'My Business'),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. ADD user_id TO ALL DATA TABLES
-- ============================================================================

-- clients
alter table public.clients add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_clients_user_id on public.clients(user_id);

-- invoices
alter table public.invoices add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_invoices_user_id on public.invoices(user_id);

-- bank_statements
alter table public.bank_statements add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_bank_statements_user_id on public.bank_statements(user_id);

-- ============================================================================
-- 3. UPDATE RLS POLICIES — data isolation per user
-- ============================================================================

-- CLIENTS
drop policy if exists "Allow authenticated users full access" on public.clients;
drop policy if exists "Users access own clients" on public.clients;
create policy "Users access own clients"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INVOICES
drop policy if exists "Allow authenticated users full access" on public.invoices;
drop policy if exists "Users access own invoices" on public.invoices;
create policy "Users access own invoices"
  on public.invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Portal token public read (for client-facing portal, no auth required)
drop policy if exists "Public portal token read" on public.invoices;
create policy "Public portal token read"
  on public.invoices for select
  using (portal_token is not null);

-- LINE_ITEMS (inherit access via invoice join)
drop policy if exists "Allow authenticated users full access" on public.line_items;
drop policy if exists "Users access own line items" on public.line_items;
create policy "Users access own line items"
  on public.line_items for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

-- Public line items read for portal
drop policy if exists "Public line items portal read" on public.line_items;
create policy "Public line items portal read"
  on public.line_items for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.portal_token is not null
    )
  );

-- TIMELINE_EVENTS
drop policy if exists "Allow authenticated users full access" on public.timeline_events;
drop policy if exists "Users access own timeline events" on public.timeline_events;
create policy "Users access own timeline events"
  on public.timeline_events for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

-- BANK_STATEMENTS
drop policy if exists "Allow authenticated users full access" on public.bank_statements;
drop policy if exists "Users access own bank statements" on public.bank_statements;
create policy "Users access own bank statements"
  on public.bank_statements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- BANK_TRANSACTIONS
drop policy if exists "Allow authenticated users full access" on public.bank_transactions;
drop policy if exists "Users access own bank transactions" on public.bank_transactions;
create policy "Users access own bank transactions"
  on public.bank_transactions for all
  using (
    exists (
      select 1 from public.bank_statements bs
      where bs.id = statement_id and bs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bank_statements bs
      where bs.id = statement_id and bs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. UPDATED_AT trigger for workspaces
-- ============================================================================
create trigger update_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- DONE — run this once in Supabase SQL Editor
-- ============================================================================
