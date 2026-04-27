-- Migration: add_payment_surcharge_and_saved_methods
-- Date: 2026-04-27
-- Purpose: Add credit card surcharge support and Stripe saved payment methods

-- Add credit card surcharge settings to workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS card_surcharge_rate numeric DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS surcharge_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS surcharge_label text DEFAULT 'Processing fee';

-- Add Stripe customer ID to clients for saved payment methods
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add surcharge tracking to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric DEFAULT 0;

-- Index for quick Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id
  ON clients (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN workspaces.card_surcharge_rate IS 'Percentage surcharge applied to credit card payments (e.g. 3.0 = 3%)';
COMMENT ON COLUMN workspaces.surcharge_enabled IS 'Whether to apply surcharge to credit card payments';
COMMENT ON COLUMN workspaces.surcharge_label IS 'Label shown to customer for the surcharge line item';
COMMENT ON COLUMN clients.stripe_customer_id IS 'Stripe Customer ID for saved payment methods';
COMMENT ON COLUMN invoices.surcharge_amount IS 'Credit card surcharge amount added to this invoice';
