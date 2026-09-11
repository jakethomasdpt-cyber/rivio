-- Captured from the live Rivio schema on 2026-09-11. No customer data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public."bank_statements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "filename" text NOT NULL,
  "file_url" text,
  "file_type" text NOT NULL,
  "parsed" boolean DEFAULT false,
  "upload_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid
);

CREATE TABLE public."bank_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "statement_id" uuid,
  "date" date NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "type" text NOT NULL,
  "matched_invoice_id" uuid,
  "category" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."clients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "address" text,
  "city" text,
  "state" text,
  "zip" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid,
  "stripe_customer_id" text
);

CREATE TABLE public."idempotency_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE public."invoice_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."invoices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_number" text NOT NULL,
  "client_id" uuid,
  "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
  "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(10,2) DEFAULT 0 NOT NULL,
  "total" numeric(10,2) DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "payment_method" text,
  "due_date" date NOT NULL,
  "paid_date" date,
  "notes" text,
  "internal_notes" text,
  "portal_token" text DEFAULT encode(gen_random_bytes(32), 'hex'::text) NOT NULL,
  "stripe_payment_intent_id" text,
  "stripe_checkout_session_id" text,
  "reminder_enabled" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "viewed_at" timestamp with time zone,
  "user_id" uuid,
  "accept_credit_card" boolean DEFAULT true NOT NULL,
  "accept_venmo" boolean DEFAULT false NOT NULL,
  "accept_zelle" boolean DEFAULT false NOT NULL,
  "accept_ach" boolean DEFAULT false NOT NULL,
  "accept_wallet" boolean DEFAULT true NOT NULL,
  "surcharge_amount" numeric DEFAULT 0,
  "veda_organization_id" text,
  "veda_patient_id" text,
  "veda_invoice_id" text,
  "veda_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "paid_amount" numeric(10,2) DEFAULT 0 NOT NULL,
  "latest_payment_failure" text,
  "voided_at" timestamp with time zone,
  "refunded_at" timestamp with time zone
);

CREATE TABLE public."line_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "service" text NOT NULL,
  "description" text,
  "service_date" date,
  "provider" text NOT NULL,
  "rate" numeric(10,2) NOT NULL,
  "quantity" numeric(8,2) DEFAULT 1 NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "veda_source_type" text,
  "veda_source_id" text,
  "veda_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public."mileage_trips" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "start_address" text DEFAULT ''::text NOT NULL,
  "end_address" text DEFAULT ''::text NOT NULL,
  "start_lat" double precision,
  "start_lng" double precision,
  "end_lat" double precision,
  "end_lng" double precision,
  "miles" numeric(10,2) NOT NULL,
  "purpose" text,
  "irs_deduction" numeric(10,2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."payment_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "status" text NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "payment_method" text NOT NULL,
  "payment_processor" text,
  "processor_payment_id" text,
  "failure_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."timeline_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."veda_integration_customers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "veda_organization_id" text NOT NULL,
  "veda_patient_id" text NOT NULL,
  "rivio_customer_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "patient_name" text NOT NULL,
  "patient_email" text,
  "patient_phone" text,
  "patient_dob" date,
  "patient_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."veda_organization_mappings" (
  "veda_organization_id" text NOT NULL,
  "display_name" text DEFAULT 'Veda EMR'::text NOT NULL,
  "user_id" uuid NOT NULL,
  "workspace_id" uuid,
  "webhook_base_url" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."webhook_deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "invoice_id" uuid,
  "destination_url" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "response_status" integer,
  "response_body" text,
  "request_body" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "next_retry_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."workspaces" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "business_name" text DEFAULT 'My Business'::text NOT NULL,
  "owner_name" text,
  "email" text,
  "phone" text,
  "address" text,
  "city" text,
  "state" text,
  "zip" text,
  "website" text,
  "logo_url" text,
  "brand_color" text DEFAULT '#004a99'::text,
  "venmo_handle" text,
  "zelle_phone" text,
  "stripe_account_id" text,
  "invoice_prefix" text DEFAULT 'INV'::text,
  "invoice_footer" text,
  "tax_rate_default" numeric(5,2) DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "card_surcharge_rate" numeric DEFAULT 3.0,
  "surcharge_enabled" boolean DEFAULT true,
  "surcharge_label" text DEFAULT 'Processing fee'::text
);

ALTER TABLE public."veda_integration_customers" ADD CONSTRAINT "veda_integration_customers_pkey" PRIMARY KEY (id);

ALTER TABLE public."veda_integration_customers" ADD CONSTRAINT "veda_integration_customers_veda_organization_id_veda_patien_key" UNIQUE (veda_organization_id, veda_patient_id);

ALTER TABLE public."clients" ADD CONSTRAINT "clients_pkey" PRIMARY KEY (id);

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])));

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_payment_method_check" CHECK ((payment_method = ANY (ARRAY['stripe'::text, 'venmo'::text, 'zelle'::text, 'other'::text])));

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY (id);

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE (invoice_number);

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_portal_token_key" UNIQUE (portal_token);

ALTER TABLE public."line_items" ADD CONSTRAINT "line_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."timeline_events" ADD CONSTRAINT "timeline_events_event_type_check" CHECK ((event_type = ANY (ARRAY['created'::text, 'sent'::text, 'viewed'::text, 'paid'::text, 'reminder_sent'::text, 'overdue'::text, 'cancelled'::text])));

ALTER TABLE public."timeline_events" ADD CONSTRAINT "timeline_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."bank_statements" ADD CONSTRAINT "bank_statements_file_type_check" CHECK ((file_type = ANY (ARRAY['pdf'::text, 'csv'::text])));

ALTER TABLE public."bank_statements" ADD CONSTRAINT "bank_statements_pkey" PRIMARY KEY (id);

ALTER TABLE public."bank_transactions" ADD CONSTRAINT "bank_transactions_type_check" CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text])));

ALTER TABLE public."bank_transactions" ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."workspaces" ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY (id);

ALTER TABLE public."workspaces" ADD CONSTRAINT "workspaces_user_id_key" UNIQUE (user_id);

ALTER TABLE public."mileage_trips" ADD CONSTRAINT "mileage_trips_pkey" PRIMARY KEY (id);

ALTER TABLE public."veda_organization_mappings" ADD CONSTRAINT "veda_organization_mappings_pkey" PRIMARY KEY (veda_organization_id);

ALTER TABLE public."line_items" ADD CONSTRAINT "line_items_veda_source_type_check" CHECK (((veda_source_type IS NULL) OR (veda_source_type = ANY (ARRAY['cash_visit'::text, 'insurance_claim'::text, 'custom'::text]))));

ALTER TABLE public."invoice_events" ADD CONSTRAINT "invoice_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])));

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_payment_method_check" CHECK ((payment_method = ANY (ARRAY['card'::text, 'debit'::text, 'ach'::text, 'bank_transfer'::text, 'other'::text])));

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_pkey" PRIMARY KEY (id);

ALTER TABLE public."idempotency_keys" ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY (id);

ALTER TABLE public."idempotency_keys" ADD CONSTRAINT "idempotency_keys_scope_key_key" UNIQUE (scope, key);

ALTER TABLE public."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])));

ALTER TABLE public."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY (id);

ALTER TABLE public."veda_organization_mappings" ADD CONSTRAINT "veda_organization_mappings_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE public."veda_integration_customers" ADD CONSTRAINT "veda_integration_customers_rivio_customer_id_fkey" FOREIGN KEY (rivio_customer_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE public."veda_integration_customers" ADD CONSTRAINT "veda_integration_customers_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE public."line_items" ADD CONSTRAINT "line_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public."timeline_events" ADD CONSTRAINT "timeline_events_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public."bank_transactions" ADD CONSTRAINT "bank_transactions_statement_id_fkey" FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE;

ALTER TABLE public."bank_transactions" ADD CONSTRAINT "bank_transactions_matched_invoice_id_fkey" FOREIGN KEY (matched_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE public."workspaces" ADD CONSTRAINT "workspaces_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."bank_statements" ADD CONSTRAINT "bank_statements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."mileage_trips" ADD CONSTRAINT "mileage_trips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."veda_organization_mappings" ADD CONSTRAINT "veda_organization_mappings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."veda_integration_customers" ADD CONSTRAINT "veda_integration_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.auth_user(id) ON DELETE CASCADE;

ALTER TABLE public."invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);

CREATE INDEX idx_clients_stripe_customer_id ON public.clients USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX idx_timeline_events_invoice_id ON public.timeline_events USING btree (invoice_id);

CREATE INDEX idx_bank_statements_user_id ON public.bank_statements USING btree (user_id);

CREATE INDEX idx_bank_transactions_statement_id ON public.bank_transactions USING btree (statement_id);

CREATE INDEX idx_veda_integration_customers_user_id ON public.veda_integration_customers USING btree (user_id);

CREATE INDEX idx_veda_integration_customers_client_id ON public.veda_integration_customers USING btree (client_id);

CREATE INDEX idx_veda_organization_mappings_user_id ON public.veda_organization_mappings USING btree (user_id);

CREATE INDEX idx_line_items_invoice_id ON public.line_items USING btree (invoice_id);

CREATE INDEX idx_line_items_veda_source ON public.line_items USING btree (veda_source_type, veda_source_id);

CREATE INDEX mileage_trips_user_date_idx ON public.mileage_trips USING btree (user_id, date DESC);

CREATE INDEX idx_invoices_client_id ON public.invoices USING btree (client_id);

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);

CREATE INDEX idx_invoices_portal_token ON public.invoices USING btree (portal_token);

CREATE INDEX idx_invoices_user_id ON public.invoices USING btree (user_id);

CREATE UNIQUE INDEX idx_invoices_veda_unique ON public.invoices USING btree (veda_organization_id, veda_invoice_id) WHERE ((veda_organization_id IS NOT NULL) AND (veda_invoice_id IS NOT NULL));

CREATE INDEX idx_invoices_veda_patient ON public.invoices USING btree (veda_organization_id, veda_patient_id);

CREATE INDEX idx_invoice_events_invoice_id ON public.invoice_events USING btree (invoice_id);

CREATE INDEX idx_payment_attempts_invoice_id ON public.payment_attempts USING btree (invoice_id);

CREATE UNIQUE INDEX idx_payment_attempts_processor_unique ON public.payment_attempts USING btree (payment_processor, processor_payment_id) WHERE ((payment_processor IS NOT NULL) AND (processor_payment_id IS NOT NULL));

CREATE INDEX idx_webhook_deliveries_invoice_id ON public.webhook_deliveries USING btree (invoice_id);

CREATE INDEX idx_webhook_deliveries_retry ON public.webhook_deliveries USING btree (status, next_retry_at) WHERE (status = 'failed'::text);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
                                                                                                                                  begin
                                                                                                                                    new.updated_at = now();
                                                                                                                                      return new;
                                                                                                                                      end;
                                                                                                                                      $function$
;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_veda_organization_mappings_updated_at BEFORE UPDATE ON public.veda_organization_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_veda_integration_customers_updated_at BEFORE UPDATE ON public.veda_integration_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_deliveries_updated_at BEFORE UPDATE ON public.webhook_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE VIEW public."invoice_lines" WITH (security_invoker = true) AS  SELECT id,
    invoice_id,
    service AS label,
    description,
    quantity,
    rate,
    amount,
    veda_source_type AS source_type,
    veda_source_id AS source_id,
    veda_metadata AS metadata,
    created_at
   FROM line_items;
