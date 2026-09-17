import { providerName } from '@/lib/integrationBranding';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseClient } from '@/lib/database';
import {
  createHmacSignature,
  mapStripePaymentMethod,
  verifyHmacSignature,
  type VedaPaymentMethod,
} from '@/lib/vedaCrypto';
import {
  ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME,
  isPhysicalTherapy365Workspace,
} from '@/lib/vedaWorkspace';

export { createHmacSignature, mapStripePaymentMethod, verifyHmacSignature };
export { ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME, isPhysicalTherapy365Workspace };

export type VedaEventType =
  | 'customer.upserted'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.viewed'
  | 'invoice.payment_failed'
  | 'invoice.paid'
  | 'invoice.voided'
  | 'invoice.refunded';

export interface VedaAuthResult {
  ok: true;
  rawBody: string;
  body: any;
}

export interface VedaAuthFailure {
  ok: false;
  response: NextResponse;
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number | string | null | undefined): number {
  const value = Number(dollars || 0);
  return Math.round(value * 100);
}

export async function authenticateVedaRequest(request: NextRequest): Promise<VedaAuthResult | VedaAuthFailure> {
  const rawBody = await request.text();
  const verification = verifyHmacSignature({
    secret: process.env.VEDA_RIVIO_SHARED_SECRET || '',
    timestamp: request.headers.get('x-veda-timestamp'),
    signature: request.headers.get('x-veda-signature'),
    rawBody,
  });

  if (!verification.ok) {
    const status = verification.reason === 'misconfigured' ? 500 : 401;
    return {
      ok: false,
      response: NextResponse.json({ error: `Veda authentication ${verification.reason}` }, { status }),
    };
  }

  try {
    return { ok: true, rawBody, body: rawBody ? JSON.parse(rawBody) : {} };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function hostedInvoiceUrl(portalToken: string): string {
  return `${getAppUrl()}/portal/${portalToken}`;
}

export function hostedCustomerUrl(rivioCustomerId: string): string {
  return `${getAppUrl()}/dashboard/clients?customer=${encodeURIComponent(rivioCustomerId)}`;
}

export async function resolveVedaTenant(vedaOrganizationId: string) {
  const dbClient = createDatabaseClient();
  const { data, error } = await dbClient
    .from('veda_organization_mappings')
    .select('veda_organization_id, user_id, workspace_id, organization_name, is_active, deleted_at')
    .eq('veda_organization_id', vedaOrganizationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  const { data: workspace } = await dbClient
    .from('workspaces')
    .select('business_name')
    .eq('user_id', data.user_id)
    .single();

  if (!isPhysicalTherapy365Workspace(workspace?.business_name)) {
    console.error('[veda integration] rejected non-PT365 workspace mapping', {
      vedaOrganizationId,
      workspaceName: workspace?.business_name,
    });
    return null;
  }

  return {
    ...data,
    providerName: providerName(data.organization_name, workspace?.business_name),
  } as { veda_organization_id: string; user_id: string; workspace_id: string | null; is_active: boolean; providerName: string };
}

export async function getIdempotentResponse(scope: string, key: string | null) {
  if (!key) return null;

  const dbClient = createDatabaseClient();
  const { data } = await dbClient
    .from('idempotency_keys')
    .select('response_status, response_body')
    .eq('scope', scope)
    .eq('key', key)
    .single();

  return data
    ? NextResponse.json(data.response_body || {}, { status: data.response_status || 200 })
    : null;
}

export async function storeIdempotentResponse(scope: string, key: string | null, status: number, body: unknown) {
  if (!key) return;

  const dbClient = createDatabaseClient();
  await dbClient.from('idempotency_keys').upsert(
    {
      scope,
      key,
      response_status: status,
      response_body: body,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'scope,key' }
  );
}

export async function emitVedaInvoiceEvent({
  eventType,
  invoiceId,
  paymentMethod = 'other',
  paymentProcessor = null,
  processorPaymentId = null,
  failureMessage = null,
  metadata = {},
}: {
  eventType: VedaEventType;
  invoiceId: string;
  paymentMethod?: VedaPaymentMethod;
  paymentProcessor?: string | null;
  processorPaymentId?: string | null;
  failureMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const secret = process.env.RIVIO_VEDA_WEBHOOK_SECRET || '';
  if (!secret) return;

  const dbClient = createDatabaseClient();
  const { data: invoice, error } = await dbClient
    .from('invoices')
    .select(
      'id, invoice_number, status, total, paid_date, portal_token, veda_organization_id, veda_patient_id, veda_invoice_id, veda_metadata, client_id'
    )
    .eq('id', invoiceId)
    .single();

  if (error || !invoice?.veda_organization_id || !invoice?.veda_patient_id || !invoice?.veda_invoice_id) {
    return;
  }

  const { data: mapping } = await dbClient
    .from('veda_organization_mappings')
    .select('webhook_base_url')
    .eq('veda_organization_id', invoice.veda_organization_id)
    .single();

  const baseUrl = (mapping?.webhook_base_url || process.env.VEDA_WEBHOOK_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return;

  const { data: customerLink } = await dbClient
    .from('veda_integration_customers')
    .select('rivio_customer_id')
    .eq('client_id', invoice.client_id)
    .single();

  const eventId = crypto.randomUUID();
  const amountCents = dollarsToCents(invoice.total);
  const paidAmountCents = invoice.status === 'paid' ? amountCents : 0;
  const payload = {
    eventId,
    eventType,
    createdAt: new Date().toISOString(),
    vedaOrganizationId: invoice.veda_organization_id,
    vedaPatientId: invoice.veda_patient_id,
    vedaInvoiceId: invoice.veda_invoice_id,
    rivioCustomerId: customerLink?.rivio_customer_id || invoice.client_id,
    rivioInvoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    amountCents,
    paidAmountCents,
    paymentMethod,
    paymentProcessor,
    processorPaymentId,
    hostedInvoiceUrl: hostedInvoiceUrl(invoice.portal_token),
    paymentUrl: hostedInvoiceUrl(invoice.portal_token),
    metadata: {
      ...(invoice.veda_metadata || {}),
      ...metadata,
      latestFailure: failureMessage,
    },
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmacSignature({ secret, timestamp, rawBody });
  const webhookUrl = `${baseUrl}/api/rivio/webhook`;

  await dbClient.from('invoice_events').insert({
    id: eventId,
    invoice_id: invoice.id,
    event_type: eventType,
    payload,
  });

  const { data: delivery } = await dbClient
    .from('webhook_deliveries')
    .insert({
      event_id: eventId,
      invoice_id: invoice.id,
      destination_url: webhookUrl,
      status: 'pending',
      attempt_count: 1,
      next_retry_at: null,
      request_body: payload,
    })
    .select('id')
    .single();

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rivio-Timestamp': timestamp,
        'X-Rivio-Signature': signature,
      },
      body: rawBody,
    });

    await dbClient
      .from('webhook_deliveries')
      .update({
        status: response.ok ? 'delivered' : 'failed',
        response_status: response.status,
        response_body: await response.text().catch(() => null),
        delivered_at: response.ok ? new Date().toISOString() : null,
        next_retry_at: response.ok ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', delivery?.id);

    if (!response.ok) {
      console.error('[veda webhook] delivery failed', { eventId, invoiceId, status: response.status });
    }
  } catch (err) {
    await dbClient
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        last_error: err instanceof Error ? err.message : 'Unknown webhook delivery error',
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', delivery?.id);
    console.error('[veda webhook] delivery exception', { eventId, invoiceId, err });
  }
}

export async function emitVedaCustomerEvent({
  vedaOrganizationId,
  vedaPatientId,
  rivioCustomerId,
  metadata = {},
}: {
  vedaOrganizationId: string;
  vedaPatientId: string;
  rivioCustomerId: string;
  metadata?: Record<string, unknown>;
}) {
  const secret = process.env.RIVIO_VEDA_WEBHOOK_SECRET || '';
  if (!secret) return;

  const dbClient = createDatabaseClient();
  const { data: mapping } = await dbClient
    .from('veda_organization_mappings')
    .select('webhook_base_url')
    .eq('veda_organization_id', vedaOrganizationId)
    .single();

  const baseUrl = (mapping?.webhook_base_url || process.env.VEDA_WEBHOOK_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return;

  const eventId = crypto.randomUUID();
  const payload = {
    eventId,
    eventType: 'customer.upserted',
    createdAt: new Date().toISOString(),
    vedaOrganizationId,
    vedaPatientId,
    vedaInvoiceId: null,
    rivioCustomerId,
    rivioInvoiceId: null,
    invoiceNumber: null,
    status: null,
    amountCents: 0,
    paidAmountCents: 0,
    paymentMethod: 'other',
    paymentProcessor: null,
    processorPaymentId: null,
    hostedInvoiceUrl: null,
    paymentUrl: null,
    metadata,
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmacSignature({ secret, timestamp, rawBody });
  const webhookUrl = `${baseUrl}/api/rivio/webhook`;

  const { data: delivery } = await dbClient
    .from('webhook_deliveries')
    .insert({
      event_id: eventId,
      invoice_id: null,
      destination_url: webhookUrl,
      status: 'pending',
      attempt_count: 1,
      request_body: payload,
    })
    .select('id')
    .single();

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rivio-Timestamp': timestamp,
        'X-Rivio-Signature': signature,
      },
      body: rawBody,
    });

    await dbClient
      .from('webhook_deliveries')
      .update({
        status: response.ok ? 'delivered' : 'failed',
        response_status: response.status,
        response_body: await response.text().catch(() => null),
        delivered_at: response.ok ? new Date().toISOString() : null,
        next_retry_at: response.ok ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', delivery?.id);
  } catch (err) {
    await dbClient
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        last_error: err instanceof Error ? err.message : 'Unknown webhook delivery error',
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', delivery?.id);
    console.error('[veda webhook] customer delivery exception', { eventId, err });
  }
}
