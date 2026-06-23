import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { dollarsToCents, hostedInvoiceUrl, verifyHmacSignature } from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

function authenticateStatusRequest(request: NextRequest): NextResponse | null {
  const verification = verifyHmacSignature({
    secret: process.env.VEDA_RIVIO_SHARED_SECRET || '',
    timestamp: request.headers.get('x-veda-timestamp'),
    signature: request.headers.get('x-veda-signature'),
    rawBody: '',
  });

  if (!verification.ok) {
    const status = verification.reason === 'misconfigured' ? 500 : 401;
    return NextResponse.json({ error: `Veda authentication ${verification.reason}` }, { status });
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rivioInvoiceId: string }> }
) {
  const authError = authenticateStatusRequest(request);
  if (authError) return authError;

  try {
    const { rivioInvoiceId } = await params;
    const supabase = createServerSupabaseClient();

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, subtotal, tax_amount, total, paid_amount, due_date, sent_at, viewed_at, paid_date, latest_payment_failure, portal_token, veda_organization_id, veda_patient_id, veda_invoice_id, veda_metadata'
      )
      .eq('id', rivioInvoiceId)
      .single();

    if (error || !invoice?.veda_organization_id) {
      return NextResponse.json({ error: 'Veda invoice not found' }, { status: 404 });
    }

    const { data: attempts } = await supabase
      .from('payment_attempts')
      .select('id, status, amount_cents, payment_method, payment_processor, processor_payment_id, failure_message, metadata, created_at')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      rivioInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      vedaOrganizationId: invoice.veda_organization_id,
      vedaPatientId: invoice.veda_patient_id,
      vedaInvoiceId: invoice.veda_invoice_id,
      subtotalCents: dollarsToCents(invoice.subtotal),
      taxAmountCents: dollarsToCents(invoice.tax_amount),
      amountCents: dollarsToCents(invoice.total),
      paidAmountCents: dollarsToCents(invoice.paid_amount || (invoice.status === 'paid' ? invoice.total : 0)),
      dueDate: invoice.due_date,
      hostedInvoiceUrl: hostedInvoiceUrl(invoice.portal_token),
      paymentUrl: hostedInvoiceUrl(invoice.portal_token),
      sentAt: invoice.sent_at,
      viewedAt: invoice.viewed_at,
      paidAt: invoice.paid_date,
      paymentAttempts: attempts || [],
      latestFailure: invoice.latest_payment_failure,
      metadata: invoice.veda_metadata || {},
    });
  } catch (err) {
    console.error('GET /api/veda/invoices/[rivioInvoiceId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
