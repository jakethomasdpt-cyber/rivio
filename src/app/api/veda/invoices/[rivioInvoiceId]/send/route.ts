import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  authenticateVedaRequest,
  emitVedaInvoiceEvent,
  getIdempotentResponse,
  hostedInvoiceUrl,
  storeIdempotentResponse,
} from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

function escapeHtml(value: unknown): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function invoiceEmailHtml(invoice: any, client: any, workspace: any, url: string) {
  const businessName = escapeHtml(workspace?.business_name || 'Rivio');
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace.brand_color : '#004a99';
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="background:${brandColor};padding:24px 32px;color:white;"><h1 style="margin:0;font-size:22px;">${businessName}</h1><p style="margin:6px 0 0;font-size:13px;">Invoice ${escapeHtml(invoice.invoice_number)}</p></td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 12px;">Hi ${escapeHtml(client?.name || 'there')},</p>
<p style="margin:0 0 24px;color:#475569;">Your invoice is ready to review and pay securely online.</p>
<p style="margin:0 0 24px;font-size:28px;font-weight:800;">${Number(invoice.total || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
<a href="${url}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:8px;">View &amp; Pay Invoice</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rivioInvoiceId: string }> }
) {
  const auth = await authenticateVedaRequest(request);
  if (!auth.ok) return auth.response;

  const { rivioInvoiceId } = await params;
  const idempotencyKey = request.headers.get('idempotency-key');
  const scope = `veda.invoice.send.${rivioInvoiceId}`;
  const cached = await getIdempotentResponse(scope, idempotencyKey);
  if (cached) return cached;

  try {
    const supabase = createServerSupabaseClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, clients(name, email)')
      .eq('id', rivioInvoiceId)
      .single();

    if (error || !invoice?.veda_organization_id) {
      return NextResponse.json({ error: 'Veda invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice cannot be sent in its current status' }, { status: 409 });
    }

    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    const patientEmail = auth.body.patientEmail || auth.body.email || client?.email;
    if (!patientEmail) {
      return NextResponse.json({ error: 'Patient email is required to send invoice' }, { status: 400 });
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    const sentAt = invoice.sent_at || new Date().toISOString();
    const responseBody = {
      rivioInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: invoice.sent_at ? invoice.status : 'sent',
      sentAt,
      alreadySent: Boolean(invoice.sent_at),
      hostedInvoiceUrl: hostedInvoiceUrl(invoice.portal_token),
      paymentUrl: hostedInvoiceUrl(invoice.portal_token),
    };

    if (invoice.sent_at) {
      await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);
      return NextResponse.json(responseBody);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const businessName = workspace?.business_name || 'Rivio';
    const url = hostedInvoiceUrl(invoice.portal_token);
    const { error: emailError } = await resend.emails.send({
      from: `${businessName} <invoices@physicaltherapy365.com>`,
      replyTo: workspace?.email || 'jakethomasdpt@gmail.com',
      to: patientEmail,
      subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
      html: invoiceEmailHtml(invoice, client, workspace, url),
    });

    if (emailError) {
      console.error('Veda invoice send email error:', emailError);
      return NextResponse.json({ error: 'Failed to send invoice email' }, { status: 502 });
    }

    await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', invoice.id);

    await supabase.from('timeline_events').insert({
      invoice_id: invoice.id,
      event_type: 'sent',
      description: 'Veda invoice sent to patient',
      metadata: { to: patientEmail },
      created_at: sentAt,
    });

    await emitVedaInvoiceEvent({ eventType: 'invoice.sent', invoiceId: invoice.id });
    await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error('POST /api/veda/invoices/[rivioInvoiceId]/send error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
