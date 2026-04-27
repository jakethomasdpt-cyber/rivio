import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const body = await request.json();
    const { payment_method, paid_date } = body;

    if (!payment_method) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Verify invoice belongs to user
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const finalPaidDate = paid_date || now;

    // Update invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: finalPaidDate,
        payment_method,
        updated_at: now,
      })
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      );
    }

    // Create timeline event
    await supabase.from('timeline_events').insert([
      {
        invoice_id: invoiceId,
        event_type: 'paid',
        description: 'Invoice marked as paid',
        created_at: now,
      },
    ]);

    // Fetch line items for response
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    // Send payment notification email to business
    try {
      // Get invoice details for the email
      const { data: fullInvoice } = await supabase
        .from('invoices')
        .select('*, clients(name, email)')
        .eq('id', invoiceId)
        .single();

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('business_name, brand_color, email')
        .eq('user_id', user.id)
        .single();

      if (fullInvoice) {
        const businessName = workspace?.business_name || 'Physical Therapy 365';
        const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace!.brand_color! : '#004a99';
        const businessEmail = workspace?.email || 'jakethomasdpt@gmail.com';
        const clientData = Array.isArray(fullInvoice.clients) ? fullInvoice.clients[0] : fullInvoice.clients;
        const clientName = (clientData as any)?.name || 'Unknown';

        const pmLabels: Record<string, string> = {
          stripe: 'Stripe',
          venmo: 'Venmo',
          zelle: 'Zelle',
          other: 'Manual / Other',
        };
        const pmLabel = pmLabels[payment_method] || payment_method;

        const formatCurrency = (amount: number) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
        const formatDate = (date: string) =>
          new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const escapeHtml = (str: string) =>
          String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `${businessName} <invoices@physicaltherapy365.com>`,
          to: businessEmail,
          subject: `Payment received — ${fullInvoice.invoice_number} (${formatCurrency(fullInvoice.total)})`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr>
        <td style="background:${brandColor};border-radius:12px 12px 0 0;padding:24px 32px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${escapeHtml(businessName)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Payment received</p>
        </td>
      </tr>
      <tr>
        <td style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;width:56px;height:56px;background:#dcfce7;border-radius:50%;line-height:56px;font-size:28px;">&#10003;</div>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;text-align:center;">
            Invoice <strong>${escapeHtml(fullInvoice.invoice_number)}</strong> has been paid!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Client</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(clientName)}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Payment Method</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(pmLabel)}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Date Paid</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${formatDate(finalPaidDate)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#1e293b;padding-top:8px;border-top:1px solid #e2e8f0;">Amount</td>
                  <td align="right" style="font-size:18px;font-weight:700;color:#16a34a;padding-top:8px;border-top:1px solid #e2e8f0;">${formatCurrency(fullInvoice.total)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">This is an automated payment confirmation for your records.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
        });
      }
    } catch (bizEmailErr) {
      // Non-critical — log but don't fail the request
      console.error('Failed to send business payment notification:', bizEmailErr);
    }

    return NextResponse.json({
      ...invoice,
      line_items: lineItems || [],
    });
  } catch (err) {
    console.error('POST /api/invoices/[id]/mark-paid error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
