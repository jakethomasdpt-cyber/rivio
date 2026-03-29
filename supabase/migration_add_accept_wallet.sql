-- ============================================================================
-- Migration: add accept_wallet column to invoices table
-- Run this once in the Supabase SQL Editor
-- ============================================================================

alter table public.invoices
  add column if not exists accept_wallet boolean not null default true;

-- Backfill: existing invoices with Stripe enabled (accept_credit_card = true)
-- should also have wallet pay enabled so no change in experience for prior invoices.
update public.invoices
  set accept_wallet = true
  where accept_credit_card = true;
