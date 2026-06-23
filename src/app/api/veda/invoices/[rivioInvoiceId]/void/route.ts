import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  authenticateVedaRequest,
  emitVedaInvoiceEvent,
  getIdempotentResponse,
  storeIdempotentResponse,
} from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rivioInvoiceId: string }> }
) {
  const auth = await authenticateVedaRequest(request);
  if (!auth.ok) return auth.response;

  const { rivioInvoiceId } = await params;
  const idempotencyKey = request.headers.get('idempotency-key');
  const scope = `veda.invoice.void.${rivioInvoiceId}`;
  const cached = await getIdempotentResponse(scope, idempotencyKey);
  if (cached) return cached;

  try {
    const supabase = createServerSupabaseClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, veda_organization_id')
      .eq('id', rivioInvoiceId)
      .single();

    if (error || !invoice?.veda_organization_id) {
      return NextResponse.json({ error: 'Veda invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Paid invoices cannot be voided' }, { status: 409 });
    }

    const now = new Date().toISOString();
    if (invoice.status !== 'cancelled') {
      await supabase
        .from('invoices')
        .update({ status: 'cancelled', voided_at: now })
        .eq('id', invoice.id);

      await supabase.from('timeline_events').insert({
        invoice_id: invoice.id,
        event_type: 'cancelled',
        description: 'Invoice voided by Veda EMR',
        metadata: auth.body.metadata || {},
        created_at: now,
      });

      await emitVedaInvoiceEvent({ eventType: 'invoice.voided', invoiceId: invoice.id });
    }

    const responseBody = {
      rivioInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: 'cancelled',
      voidedAt: invoice.status === 'cancelled' ? null : now,
    };

    await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);
    return NextResponse.json(responseBody);
  } catch (err) {
    console.error('POST /api/veda/invoices/[rivioInvoiceId]/void error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
