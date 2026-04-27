import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

// Next.js requires raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Payment confirmation email ───────────────────────────────────────────────

function generatePaymentConfirmationEmail({
  businessName,
  brandColor,
  clientName,
  invoiceNumber,
  total,
  paidDate,
  paymentMethodLabel,
  portalUrl,
}: {
  businessName: string;
  brandColor: string;
  clientName: string;
  invoiceNumber: string;
  total: number;
  paidDate: string;
  paymentMethodLabel: string;
  portalUrl: string;
}): string {
  const safeBusinessName = escapeHtml(businessName);
  const safeClientName = escapeHtml(clientName);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safePaymentMethod = escapeHtml(paymentMethodLabel);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Payment Received</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:${brandColor};border-radius:10px;padding:10px 24px;">
                  <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${safeBusinessName}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Success banner -->
        <tr>
          <td style="background:#ffffff;border-radius:16px 16px 0 0;border:1px solid #e2e8f0;border-bottom:none;padding:40px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:inline-block;text-align:center;line-height:64px;font-size:32px;">✓</div>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <h1 style="margin:0;font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">Payment received!</h1>
                  <p style="margin:10px 0 0;font-size:15px;color:#64748b;">Hi ${safeClientName}, thank you — your payment has been processed successfully.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Receipt box -->
        <tr>
          <td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-bottom:none;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
                        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;">Payment Summary</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:14px;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="font-size:14px;color:#64748b;padding-bottom:8px;">Invoice</td>
                            <td align="right" style="font-size:14px;font-weight:600;color:#0f172a;padding-bottom:8px;">${safeInvoiceNumber}</td>
                          </tr>
                          <tr>
                            <td style="font-size:14px;color:#64748b;padding-bottom:8px;">Date paid</td>
                            <td align="right" style="font-size:14px;font-weight:600;color:#0f172a;padding-bottom:8px;">${escapeHtml(paidDate)}</td>
                          </tr>
                          <tr>
                            <td style="font-size:14px;color:#64748b;padding-bottom:8px;">Payment method</td>
                            <td align="right" style="font-size:14px;font-weight:600;color:#0f172a;padding-bottom:8px;">${safePaymentMethod}</td>
                          </tr>
                          <tr>
                            <td style="font-size:16px;font-weight:700;color:#0f172a;padding-top:12px;border-top:1px solid #e2e8f0;">Amount paid</td>
                            <td align="right" style="font-size:22px;font-weight:700;color:#16a34a;padding-top:12px;border-top:1px solid #e2e8f0;">${escapeHtml(formatCurrency(total))}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px 40px;text-align:center;">
            <p style="margin:0 0 20px;font-size:14px;color:#64748b;">View your invoice receipt anytime:</p>
            <a href="${portalUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:13px 32px;border-radius:8px;">View Invoice Receipt →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;">
              This receipt was sent by <strong style="color:#64748b;">${safeBusinessName}</strong>.<br />
              Reply to this email with any questions.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Core: mark invoice paid ──────────────────────────────────────────────────

async function markInvoicePaid({
  invoiceId,
  stripeSessionId,
  stripePaymentIntentId,
  paymentMethodType, // 'card' | 'us_bank_account' | 'unknown'
}: {
  invoiceId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  paymentMethodType: string;
}) {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const today = now.split('T')[0]; // YYYY-MM-DD for the date column

  // Idempotency — check if already paid to avoid double-processing
  // NOTE: client_name/client_email are on the clients table, not invoices directly.
  // Join via clients(name, email) and fetch workspace separately via user_id.
  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, invoice_number, total, portal_token, user_id, clients(name, email)')
    .eq('id', invoiceId)
    .single();

  if (fetchError || !existing) {
    console.error(`[webhook] Invoice ${invoiceId} not found:`, fetchError?.message);
    return;
  }

  if (existing.status === 'paid') {
    console.log(`[webhook] Invoice ${invoiceId} already paid — skipping`);
    return;
  }

  const pmLabel =
    paymentMethodType === 'us_bank_account'
      ? 'ACH Bank Transfer'
      : paymentMethodType === 'card'
      ? 'Credit / Debit Card'
      : 'Card';

  // Update invoice status → paid
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_date: today,
      payment_method: 'stripe',
      stripe_checkout_session_id: stripeSessionId || undefined,
      stripe_payment_intent_id: stripePaymentIntentId || undefined,
      updated_at: now,
    })
    .eq('id', invoiceId);

  if (updateError) {
    console.error('[webhook] Failed to update invoice:', updateError);
    return;
  }

  // Log timeline event
  await supabase.from('timeline_events').insert([{
    invoice_id: invoiceId,
    event_type: 'paid',
    description: `Payment received via ${pmLabel}`,
    created_at: now,
  }]);

  console.log(`[webhook] Invoice ${invoiceId} marked paid via ${pmLabel}`);

  // Send payment confirmation email to client
  const clientData = Array.isArray(existing.clients) ? existing.clients[0] : existing.clients;
  const clientEmail = (clientData as any)?.email;
  const clientName = (clientData as any)?.name;

  if (!clientEmail) {
    console.log('[webhook] No client email — skipping confirmation email');
    return;
  }

  // Fetch workspace for branding (separate query since no direct FK invoices→workspaces)
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('business_name, brand_color, email')
    .eq('user_id', existing.user_id)
    .single();

  const businessName = workspace?.business_name || 'Physical Therapy 365';
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '')
    ? workspace!.brand_color!
    : '#2563eb';
  const replyEmail = workspace?.email || 'jakethomasdpt@gmail.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice.physicaltherapy365.com';
  const portalUrl = `${appUrl}/portal/${existing.portal_token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error: emailError } = await resend.emails.send({
    from: `${businessName} <invoices@physicaltherapy365.com>`,
    replyTo: replyEmail,
    to: [clientEmail],
    subject: `Payment received — ${existing.invoice_number}`,
    html: generatePaymentConfirmationEmail({
      businessName,
      brandColor,
      clientName: clientName || 'there',
      invoiceNumber: existing.invoice_number,
      total: existing.total,
      paidDate: formatDate(today),
      paymentMethodLabel: pmLabel,
      portalUrl,
    }),
  });

  if (emailError) {
    console.error('[webhook] Failed to send confirmation email:', emailError);
  } else {
    console.log(`[webhook] Confirmation email sent to ${clientEmail}`);
  }

  // Also send payment notification to business email
  try {
    const bizEmail = workspace?.email || replyEmail;
    await resend.emails.send({
      from: `${businessName} <invoices@physicaltherapy365.com>`,
      to: [bizEmail],
      subject: `Payment received — ${existing.invoice_number} (${formatCurrency(existing.total)})`,
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
            Invoice <strong>${escapeHtml(existing.invoice_number)}</strong> has been paid via <strong>${escapeHtml(pmLabel)}</strong>!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Client</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(clientName || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Payment</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(pmLabel)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#1e293b;padding-top:8px;border-top:1px solid #e2e8f0;">Amount</td>
                  <td align="right" style="font-size:18px;font-weight:700;color:#16a34a;padding-top:8px;border-top:1px solid #e2e8f0;">${formatCurrency(existing.total)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Automated payment confirmation for your records.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
    });
    console.log(`[webhook] Business payment notification sent to ${bizEmail}`);
  } catch (bizErr) {
    console.error('[webhook] Failed to send business payment notification:', bizErr);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'your_webhook_secret') {
      console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(Buffer.from(body), signature, webhookSecret);
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[webhook] Received event: ${event.type}`);

    // ── checkout.session.completed ──────────────────────────────────────────
    // Fires immediately when Stripe Checkout is completed (card payments).
    // For ACH, this fires when the session is completed but funds may still be
    // pending — payment_intent.succeeded fires when funds actually clear.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      if (!invoiceId) {
        console.error('[webhook] checkout.session.completed: no invoice_id in metadata');
        return NextResponse.json({ received: true });
      }

      // Detect payment method from session
      const pmTypes = session.payment_method_types || [];
      const paymentMethodType = pmTypes.includes('us_bank_account')
        ? 'us_bank_account'
        : 'card';

      // For ACH, only mark paid if payment_status is 'paid' (funds cleared)
      // Otherwise wait for payment_intent.succeeded
      if (paymentMethodType === 'us_bank_account' && session.payment_status !== 'paid') {
        console.log('[webhook] ACH session complete but payment_status is pending — waiting for payment_intent.succeeded');
        return NextResponse.json({ received: true });
      }

      await markInvoicePaid({
        invoiceId,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string | null,
        paymentMethodType,
      });
    }

    // ── payment_intent.succeeded ────────────────────────────────────────────
    // Backup for card payments + primary handler for ACH (fires when ACH clears,
    // which can be 1-4 business days after checkout.session.completed).
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = paymentIntent.metadata?.invoice_id;

      if (!invoiceId) {
        // Try to look up via stored stripe_checkout_session_id
        // (metadata may not be on the payment intent for older flows)
        console.log('[webhook] payment_intent.succeeded: no invoice_id in metadata — skipping');
        return NextResponse.json({ received: true });
      }

      const pmType = paymentIntent.payment_method_types?.includes('us_bank_account')
        ? 'us_bank_account'
        : 'card';

      await markInvoicePaid({
        invoiceId,
        stripeSessionId: '',
        stripePaymentIntentId: paymentIntent.id,
        paymentMethodType: pmType,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
