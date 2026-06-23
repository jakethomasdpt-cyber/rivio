import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  authenticateVedaRequest,
  centsToDollars,
  emitVedaInvoiceEvent,
  generateInvoiceNumber,
  getIdempotentResponse,
  hostedInvoiceUrl,
  resolveVedaTenant,
  storeIdempotentResponse,
} from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

const SOURCE_TYPES = new Set(['cash_visit', 'insurance_claim', 'custom']);

function normalizeEmail(email: unknown): string | null {
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function requireCents(value: unknown, field: string): number {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`${field} must be a non-negative integer in cents`);
  }
  return cents;
}

async function resolveOrCreateCustomer({
  body,
  tenantUserId,
}: {
  body: any;
  tenantUserId: string;
}) {
  const supabase = createServerSupabaseClient();
  const vedaOrganizationId = requireString(body.vedaOrganizationId, 'vedaOrganizationId');
  const vedaPatientId = requireString(body.vedaPatientId, 'vedaPatientId');
  const suppliedCustomerId = typeof body.rivioCustomerId === 'string' ? body.rivioCustomerId : null;

  if (suppliedCustomerId) {
    const { data: link } = await supabase
      .from('veda_integration_customers')
      .select('client_id, rivio_customer_id')
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('veda_patient_id', vedaPatientId)
      .eq('rivio_customer_id', suppliedCustomerId)
      .single();

    if (link?.client_id) return link;
  }

  const { data: existingLink } = await supabase
    .from('veda_integration_customers')
    .select('client_id, rivio_customer_id')
    .eq('veda_organization_id', vedaOrganizationId)
    .eq('veda_patient_id', vedaPatientId)
    .single();

  if (existingLink?.client_id) return existingLink;

  const patient = body.patient || {};
  const name = requireString(patient.name || body.patientName || body.name, 'patient.name');
  const email = normalizeEmail(patient.email || body.patientEmail || body.email);
  const phone = typeof patient.phone === 'string' ? patient.phone.trim() || null : null;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      user_id: tenantUserId,
      name,
      email,
      phone,
    })
    .select('id')
    .single();

  if (clientError || !client) throw clientError || new Error('Failed to create customer');

  const { data: link, error: linkError } = await supabase
    .from('veda_integration_customers')
    .upsert(
      {
        veda_organization_id: vedaOrganizationId,
        veda_patient_id: vedaPatientId,
        rivio_customer_id: client.id,
        client_id: client.id,
        user_id: tenantUserId,
        patient_name: name,
        patient_email: email,
        patient_phone: phone,
        metadata: body.metadata || {},
      },
      { onConflict: 'veda_organization_id,veda_patient_id' }
    )
    .select('client_id, rivio_customer_id')
    .single();

  if (linkError || !link) throw linkError || new Error('Failed to link customer');
  return link;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateVedaRequest(request);
  if (!auth.ok) return auth.response;

  const idempotencyKey = request.headers.get('idempotency-key');
  const scope = 'veda.invoice.create';
  const cached = await getIdempotentResponse(scope, idempotencyKey);
  if (cached) return cached;

  try {
    const body = auth.body;
    const vedaOrganizationId = requireString(body.vedaOrganizationId, 'vedaOrganizationId');
    const vedaPatientId = requireString(body.vedaPatientId, 'vedaPatientId');
    const vedaInvoiceId = requireString(body.vedaInvoiceId, 'vedaInvoiceId');
    const dueDate = requireString(body.dueDate || body.due_date, 'dueDate');

    const tenant = await resolveVedaTenant(vedaOrganizationId);
    if (!tenant) {
      return NextResponse.json({ error: 'Unknown or inactive Veda organization mapping' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, portal_token')
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('veda_invoice_id', vedaInvoiceId)
      .single();

    if (existing) {
      const responseBody = {
        rivioInvoiceId: existing.id,
        invoiceNumber: existing.invoice_number,
        status: existing.status,
        hostedInvoiceUrl: hostedInvoiceUrl(existing.portal_token),
        paymentUrl: hostedInvoiceUrl(existing.portal_token),
      };
      await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);
      return NextResponse.json(responseBody);
    }

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: 'lines must contain at least one invoice line' }, { status: 400 });
    }

    const customer = await resolveOrCreateCustomer({ body, tenantUserId: tenant.user_id });
    const invoiceNumber = generateInvoiceNumber();
    const subtotalCents = body.lines.reduce((sum: number, line: any, index: number) => {
      const sourceType = requireString(line.sourceType, `lines[${index}].sourceType`);
      if (!SOURCE_TYPES.has(sourceType)) throw new Error(`lines[${index}].sourceType is invalid`);
      return sum + requireCents(line.totalAmountCents, `lines[${index}].totalAmountCents`);
    }, 0);
    const status = body.status === 'draft' ? 'draft' : 'draft';

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: tenant.user_id,
        client_id: customer.client_id,
        invoice_number: invoiceNumber,
        status,
        subtotal: centsToDollars(subtotalCents),
        tax_rate: 0,
        tax_amount: 0,
        total: centsToDollars(subtotalCents),
        due_date: dueDate,
        notes: typeof body.notes === 'string' ? body.notes : null,
        internal_notes: 'Created from Veda EMR',
        reminder_enabled: false,
        accept_credit_card: true,
        accept_ach: true,
        accept_wallet: true,
        veda_organization_id: vedaOrganizationId,
        veda_patient_id: vedaPatientId,
        veda_invoice_id: vedaInvoiceId,
        veda_metadata: body.metadata || {},
      })
      .select('id, invoice_number, status, portal_token')
      .single();

    if (invoiceError || !invoice) throw invoiceError || new Error('Failed to create invoice');

    const lineItems = body.lines.map((line: any, index: number) => {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`lines[${index}].quantity must be positive`);
      }

      return {
        invoice_id: invoice.id,
        service: requireString(line.label, `lines[${index}].label`).slice(0, 500),
        description: typeof line.description === 'string' ? line.description.slice(0, 1000) : null,
        provider: 'Veda EMR',
        rate: centsToDollars(requireCents(line.unitAmountCents, `lines[${index}].unitAmountCents`)),
        quantity,
        amount: centsToDollars(requireCents(line.totalAmountCents, `lines[${index}].totalAmountCents`)),
        sort_order: index,
        veda_source_type: line.sourceType,
        veda_source_id: typeof line.sourceId === 'string' ? line.sourceId : null,
        veda_metadata: line.metadata || {},
      };
    });

    const { error: linesError } = await supabase.from('line_items').insert(lineItems);
    if (linesError) throw linesError;

    await supabase.from('timeline_events').insert({
      invoice_id: invoice.id,
      event_type: 'created',
      description: 'Invoice created from Veda EMR',
      metadata: { vedaOrganizationId, vedaPatientId, vedaInvoiceId },
    });

    const responseBody = {
      rivioInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      hostedInvoiceUrl: hostedInvoiceUrl(invoice.portal_token),
      paymentUrl: hostedInvoiceUrl(invoice.portal_token),
    };

    await storeIdempotentResponse(scope, idempotencyKey, 201, responseBody);
    await emitVedaInvoiceEvent({ eventType: 'invoice.created', invoiceId: invoice.id });

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Veda invoice';
    const status = message.includes('required') || message.includes('must') || message.includes('invalid') ? 400 : 500;
    console.error('POST /api/veda/invoices error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
