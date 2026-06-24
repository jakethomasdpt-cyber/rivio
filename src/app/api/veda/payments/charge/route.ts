import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
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

type ChargeLine = {
  label: string;
  description?: string | null;
  quantity: number;
  unitAmountCents: number;
  totalAmountCents: number;
  sourceType: 'cash_visit' | 'insurance_claim' | 'custom';
  metadata?: Record<string, unknown>;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function requireCents(value: unknown, field: string): number {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`${field} must be a positive integer in cents`);
  }
  return cents;
}

function normalizeEmail(email: unknown): string | null {
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function normalizeLines(lines: unknown, amountCents: number): ChargeLine[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [{
      label: 'Manual card charge',
      quantity: 1,
      unitAmountCents: amountCents,
      totalAmountCents: amountCents,
      sourceType: 'custom',
      metadata: {},
    }];
  }

  return lines.map((line: any, index) => {
    const sourceType = requireString(line.sourceType, `lines[${index}].sourceType`);
    if (!SOURCE_TYPES.has(sourceType)) throw new Error(`lines[${index}].sourceType is invalid`);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be positive`);
    return {
      label: requireString(line.label, `lines[${index}].label`).slice(0, 500),
      description: typeof line.description === 'string' ? line.description.slice(0, 1000) : null,
      quantity,
      unitAmountCents: requireCents(line.unitAmountCents, `lines[${index}].unitAmountCents`),
      totalAmountCents: requireCents(line.totalAmountCents, `lines[${index}].totalAmountCents`),
      sourceType: sourceType as ChargeLine['sourceType'],
      metadata: line.metadata && typeof line.metadata === 'object' ? line.metadata : {},
    };
  });
}

function cardBrand(paymentMethod: Stripe.PaymentMethod | null) {
  return paymentMethod?.card?.brand ?? null;
}

function cardLast4(paymentMethod: Stripe.PaymentMethod | null) {
  return paymentMethod?.card?.last4 ?? null;
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
  const email = normalizeEmail(patient.email || body.patientEmail || body.email) ?? `${vedaPatientId}@veda.local`;
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
  const scope = 'veda.payment.charge';
  const cached = await getIdempotentResponse(scope, idempotencyKey);
  if (cached) return cached;

  try {
    const body = auth.body;
    const vedaOrganizationId = requireString(body.vedaOrganizationId, 'vedaOrganizationId');
    const vedaPatientId = requireString(body.vedaPatientId, 'vedaPatientId');
    const vedaInvoiceId = requireString(body.vedaInvoiceId, 'vedaInvoiceId');
    const amountCents = requireCents(body.amountCents, 'amountCents');
    const lines = normalizeLines(body.lines, amountCents);
    const lineTotal = lines.reduce((sum, line) => sum + line.totalAmountCents, 0);
    if (lineTotal !== amountCents) {
      return NextResponse.json({ error: 'amountCents must equal the sum of line totalAmountCents.' }, { status: 400 });
    }

    const tenant = await resolveVedaTenant(vedaOrganizationId);
    if (!tenant) {
      return NextResponse.json({ error: 'Unknown or inactive Veda organization mapping' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const customer = await resolveOrCreateCustomer({ body, tenantUserId: tenant.user_id });
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, email, stripe_customer_id')
      .eq('id', customer.client_id)
      .eq('user_id', tenant.user_id)
      .single();
    if (!client) return NextResponse.json({ error: 'Rivio customer not found' }, { status: 404 });

    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, portal_token, stripe_payment_intent_id')
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('veda_invoice_id', vedaInvoiceId)
      .single();

    if (existingInvoice?.status === 'paid') {
      const responseBody = {
        rivioPaymentId: existingInvoice.stripe_payment_intent_id ?? existingInvoice.id,
        rivioInvoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        status: 'paid',
        paidAt: null,
        cardBrand: null,
        cardLast4: null,
        processorPaymentId: existingInvoice.stripe_payment_intent_id ?? null,
      };
      await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);
      return NextResponse.json(responseBody);
    }

    if (existingInvoice && existingInvoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled invoices cannot be charged.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    let invoice = existingInvoice as any;
    if (!invoice) {
      const invoiceNumber = generateInvoiceNumber();
      const { data: created, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: tenant.user_id,
          client_id: customer.client_id,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal: centsToDollars(amountCents),
          tax_rate: 0,
          tax_amount: 0,
          total: centsToDollars(amountCents),
          due_date: today,
          notes: null,
          internal_notes: 'Manual card charge from Veda EMR',
          reminder_enabled: false,
          accept_credit_card: true,
          accept_ach: false,
          accept_wallet: false,
          veda_organization_id: vedaOrganizationId,
          veda_patient_id: vedaPatientId,
          veda_invoice_id: vedaInvoiceId,
          veda_metadata: { ...(body.metadata || {}), manualCharge: true },
        })
        .select('id, invoice_number, status, total, portal_token, stripe_payment_intent_id')
        .single();
      if (invoiceError || !created) throw invoiceError || new Error('Failed to create manual charge invoice');
      invoice = created;

      const lineRows = lines.map((line, index) => ({
        invoice_id: invoice.id,
        service: line.label,
        description: line.description,
        provider: 'Veda EMR',
        rate: centsToDollars(line.unitAmountCents),
        quantity: line.quantity,
        amount: centsToDollars(line.totalAmountCents),
        sort_order: index,
        veda_source_type: line.sourceType,
        veda_source_id: typeof line.metadata?.sourceId === 'string' ? line.metadata.sourceId : null,
        veda_metadata: line.metadata || {},
      }));
      const { error: linesError } = await supabase.from('line_items').insert(lineRows);
      if (linesError) throw linesError;

      await supabase.from('timeline_events').insert({
        invoice_id: invoice.id,
        event_type: 'created',
        description: 'Manual card charge created from Veda EMR',
        metadata: { vedaOrganizationId, vedaPatientId, vedaInvoiceId },
        created_at: now,
      });
    } else if (Math.round(Number(invoice.total || 0) * 100) !== amountCents) {
      return NextResponse.json({ error: 'Existing Rivio invoice amount does not match this charge.' }, { status: 409 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    let stripeCustomerId = client.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        name: client.name || undefined,
        email: client.email || undefined,
        metadata: {
          pt365_client_id: client.id,
          invoice_user_id: tenant.user_id,
          vedaOrganizationId,
          vedaPatientId,
        },
      }, { idempotencyKey: `${idempotencyKey || invoice.id}:stripe-customer` });
      stripeCustomerId = stripeCustomer.id;
      await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client.id);
    }

    const paymentMethodId = typeof body.paymentMethod?.paymentMethodId === 'string'
      ? body.paymentMethod.paymentMethodId
      : null;
    if (!paymentMethodId || !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) {
      return NextResponse.json({ error: 'paymentMethod.paymentMethodId is required. Use Stripe.js secure card entry before charging.' }, { status: 400 });
    }
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethod.id,
      confirm: true,
      off_session: false,
      description: `Veda manual charge ${invoice.invoice_number}`,
      metadata: {
        invoice_id: invoice.id,
        user_id: tenant.user_id,
        vedaOrganizationId,
        vedaPatientId,
        vedaInvoiceId,
        manualCharge: 'true',
      },
    }, { idempotencyKey: `${idempotencyKey || invoice.id}:payment-intent` });

    if (paymentIntent.status !== 'succeeded') {
      const failureMessage = `Stripe payment status: ${paymentIntent.status}`;
      await recordFailedAttempt({
        invoiceId: invoice.id,
        amountCents,
        processorPaymentId: paymentIntent.id,
        failureMessage,
        metadata: { stripePaymentIntentStatus: paymentIntent.status },
      });
      await emitVedaInvoiceEvent({
        eventType: 'invoice.payment_failed',
        invoiceId: invoice.id,
        paymentMethod: 'card',
        paymentProcessor: 'stripe',
        processorPaymentId: paymentIntent.id,
        failureMessage,
      });
      const responseBody = { error: failureMessage, status: 'payment_failed', processorPaymentId: paymentIntent.id };
      await storeIdempotentResponse(scope, idempotencyKey, 402, responseBody);
      return NextResponse.json(responseBody, { status: 402 });
    }

    await recordSuccessfulCharge({
      invoice,
      amountCents,
      paymentIntent,
      paymentMethod,
      now,
      today,
    });

    const responseBody = {
      rivioPaymentId: paymentIntent.id,
      rivioInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: 'paid',
      paidAt: now,
      cardBrand: cardBrand(paymentMethod),
      cardLast4: cardLast4(paymentMethod),
      processorPaymentId: paymentIntent.id,
      hostedInvoiceUrl: hostedInvoiceUrl(invoice.portal_token),
      paymentUrl: hostedInvoiceUrl(invoice.portal_token),
    };
    await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);
    return NextResponse.json(responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process Veda card charge';
    const status = message.includes('required') || message.includes('invalid') || message.includes('must') ? 400 : 500;
    console.error('POST /api/veda/payments/charge error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}

async function recordSuccessfulCharge({
  invoice,
  amountCents,
  paymentIntent,
  paymentMethod,
  now,
  today,
}: {
  invoice: any;
  amountCents: number;
  paymentIntent: Stripe.PaymentIntent;
  paymentMethod: Stripe.PaymentMethod;
  now: string;
  today: string;
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_date: today,
      paid_amount: centsToDollars(amountCents),
      payment_method: 'stripe',
      stripe_payment_intent_id: paymentIntent.id,
      latest_payment_failure: null,
      updated_at: now,
    })
    .eq('id', invoice.id);

  await supabase.from('timeline_events').insert({
    invoice_id: invoice.id,
    event_type: 'paid',
    description: 'Manual card charge processed from Veda EMR',
    metadata: {
      stripePaymentIntentId: paymentIntent.id,
      cardBrand: cardBrand(paymentMethod),
      cardLast4: cardLast4(paymentMethod),
    },
    created_at: now,
  });

  await supabase.from('payment_attempts').upsert(
    {
      invoice_id: invoice.id,
      status: 'succeeded',
      amount_cents: amountCents,
      payment_method: 'card',
      payment_processor: 'stripe',
      processor_payment_id: paymentIntent.id,
      metadata: {
        manualCharge: true,
        cardBrand: cardBrand(paymentMethod),
        cardLast4: cardLast4(paymentMethod),
        stripePaymentIntentStatus: paymentIntent.status,
      },
    },
    { onConflict: 'payment_processor,processor_payment_id' }
  );

  await emitVedaInvoiceEvent({
    eventType: 'invoice.paid',
    invoiceId: invoice.id,
    paymentMethod: 'card',
    paymentProcessor: 'stripe',
    processorPaymentId: paymentIntent.id,
    metadata: {
      manualCharge: true,
      cardBrand: cardBrand(paymentMethod),
      cardLast4: cardLast4(paymentMethod),
    },
  });
}

async function recordFailedAttempt({
  invoiceId,
  amountCents,
  processorPaymentId,
  failureMessage,
  metadata,
}: {
  invoiceId: string;
  amountCents: number;
  processorPaymentId: string;
  failureMessage: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();
  await supabase.from('payment_attempts').upsert(
    {
      invoice_id: invoiceId,
      status: 'failed',
      amount_cents: amountCents,
      payment_method: 'card',
      payment_processor: 'stripe',
      processor_payment_id: processorPaymentId,
      failure_message: failureMessage,
      metadata,
    },
    { onConflict: 'payment_processor,processor_payment_id' }
  );
  await supabase
    .from('invoices')
    .update({ latest_payment_failure: failureMessage, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
}
