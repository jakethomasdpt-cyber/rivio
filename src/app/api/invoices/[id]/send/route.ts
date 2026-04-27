import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

/** Escape special HTML characters to prevent XSS in emails */
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateInvoiceEmailHTML(
  invoice: any,
  client: any,
  lineItems: any[],
  portalToken: string,
  workspace: any
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const portalUrl = `${appUrl}/portal/${portalToken}`;

  const businessName = escapeHtml(workspace?.business_name || 'Your Provider');
  const venmoHandle = escapeHtml(workspace?.venmo_handle || '');
  const zelleContact = escapeHtml(workspace?.zelle_phone || '');
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace.brand_color : '#1d4ed8';

  // Darken brand color slightly for hover states (simplified: use as-is for email)
  const brandColorLight = brandColor + '18'; // 10% opacity version for backgrounds

  const venmoDeepLink = venmoHandle
    ? `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${invoice.total}&note=${encodeURIComponent('Invoice ' + invoice.invoice_number)}`
    : '';

  const lineItemsHTML = lineItems
    .map((item, i) => `
    <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 14px 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.service)}</td>
      <td style="padding: 14px 16px; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.provider)}</td>
      <td style="padding: 14px 16px; font-size: 14px; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${formatCurrency(Number(item.rate) || 0)}</td>
      <td style="padding: 14px 16px; font-size: 14px; color: #1e293b; text-align: center; border-bottom: 1px solid #e2e8f0;">${Number(item.quantity) || 0}</td>
      <td style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${formatCurrency(Number(item.amount) || 0)}</td>
    </tr>`
    )
    .join('');

  // Build payment method buttons
  const paymentButtons: string[] = [];

  // Primary CTA — view & pay
  paymentButtons.push(`
    <tr>
      <td align="center" style="padding-bottom: 12px;">
        <a href="${portalUrl}" target="_blank"
           style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none;
                  padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 700;
                  letter-spacing: -0.01em; min-width: 220px; text-align: center;">
          View &amp; Pay Invoice →
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 20px;">
        <span style="font-size: 12px; color: #94a3b8;">Pay by card or bank transfer · secured by Stripe</span>
      </td>
    </tr>`);

  if (venmoHandle) {
    paymentButtons.push(`
    <tr>
      <td align="center" style="padding-bottom: 12px;">
        <a href="${venmoDeepLink}"
           style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none;
                  padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;
                  min-width: 220px; text-align: center;">
          Pay with Venmo (@${venmoHandle})
        </a>
      </td>
    </tr>`);
  }

  if (zelleContact) {
    paymentButtons.push(`
    <tr>
      <td align="center" style="padding-bottom: 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 320px; margin: 0 auto;
               background-color: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 14px 20px; text-align: center;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Pay via Zelle</p>
              <p style="margin: 6px 0 0 0; font-size: 16px; font-weight: 700; color: #1e293b; font-family: monospace;">${zelleContact}</p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">Include invoice # in the note</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`);
  }

  const paymentSection = paymentButtons.join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Invoice from ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">

        <!-- Header bar -->
        <tr>
          <td style="background-color: ${brandColor}; border-radius: 12px 12px 0 0; padding: 32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">${businessName}</p>
                </td>
                <td align="right">
                  <p style="margin: 0; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em;">Invoice</p>
                  <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">${escapeHtml(invoice.invoice_number)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- White card body -->
        <tr>
          <td style="background-color: #ffffff; padding: 0;">

            <!-- Greeting & amount due -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 32px 40px 24px; border-bottom: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 4px 0; font-size: 16px; color: #475569;">Hi ${escapeHtml(client.name)},</p>
                  <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
                    Here is your invoice from <strong style="color: #1e293b;">${businessName}</strong>.
                    Please review the details below and pay by <strong style="color: #1e293b;">${formatDate(invoice.due_date)}</strong>.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Invoice meta: dates + amount -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 24px 40px; border-bottom: 1px solid #e2e8f0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width: 33%; padding-right: 16px;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Invoice Date</p>
                        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">${formatDate(invoice.created_at)}</p>
                      </td>
                      <td style="width: 33%; padding-right: 16px;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Due Date</p>
                        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">${formatDate(invoice.due_date)}</p>
                      </td>
                      <td style="width: 33%; text-align: right;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Amount Due</p>
                        <p style="margin: 0; font-size: 22px; font-weight: 800; color: ${brandColor};">${formatCurrency(invoice.total)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Line items -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 24px 40px 0;">
                  <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Services</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Service</th>
                        <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Provider</th>
                        <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Rate</th>
                        <th style="padding: 10px 16px; text-align: center; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
                        <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lineItemsHTML}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 20px 40px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>&nbsp;</td>
                      <td style="width: 220px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 5px 0; font-size: 14px; color: #64748b;">Subtotal</td>
                            <td style="padding: 5px 0; font-size: 14px; color: #1e293b; text-align: right;">${formatCurrency(invoice.subtotal)}</td>
                          </tr>
                          ${invoice.tax_rate > 0 ? `
                          <tr>
                            <td style="padding: 5px 0; font-size: 14px; color: #64748b;">Tax (${(invoice.tax_rate * 100).toFixed(0)}%)</td>
                            <td style="padding: 5px 0; font-size: 14px; color: #1e293b; text-align: right;">${formatCurrency(invoice.tax_amount)}</td>
                          </tr>` : ''}
                          <tr>
                            <td colspan="2" style="padding-top: 8px;">
                              <div style="border-top: 2px solid #e2e8f0; margin-bottom: 8px;"></div>
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size: 16px; font-weight: 700; color: #1e293b;">Total Due</td>
                            <td style="font-size: 20px; font-weight: 800; color: ${brandColor}; text-align: right;">${formatCurrency(invoice.total)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${invoice.notes ? `
            <!-- Notes -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 0 40px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Note</p>
                        <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">${escapeHtml(invoice.notes)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>` : ''}

            <!-- Payment CTA section -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 0 40px 40px; border-top: 2px solid ${brandColor}; padding-top: 32px; margin-top: 8px;">
                  <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #1e293b; text-align: center;">Pay your invoice</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${paymentSection}
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #475569;">${businessName}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">
              Questions? Reply to this email and we'll get back to you.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #cbd5e1;">
              This invoice was sent securely via Rivio.
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
    const supabase = createServerSupabaseClient();

    // Get invoice with client info
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients(name, email)')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get workspace data
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    // Check if client has email
    const clientEmail = invoice.clients?.email;
    if (!clientEmail) {
      return NextResponse.json(
        { error: 'Client does not have an email address' },
        { status: 400 }
      );
    }

    // Generate cryptographically secure portal token if not exists
    let portalToken = invoice.portal_token;
    if (!portalToken) {
      portalToken = randomBytes(32).toString('hex'); // 256-bit secure random token
      await supabase
        .from('invoices')
        .update({
          portal_token: portalToken,
          portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        })
        .eq('id', invoiceId)
        .eq('user_id', user.id); // extra safety: only update own invoice
    }

    // Generate email HTML
    const emailHTML = generateInvoiceEmailHTML(
      invoice,
      invoice.clients,
      lineItems || [],
      portalToken,
      workspace
    );

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    const businessName = workspace?.business_name || 'Your Provider';

    const { error: emailError } = await resend.emails.send({
      from: `${businessName} <invoices@physicaltherapy365.com>`,
      replyTo: 'jakethomasdpt@gmail.com',
      to: clientEmail,
      subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
      html: emailHTML,
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    // Send a copy to the business email
    const businessEmail = workspace?.email || 'jakethomasdpt@gmail.com';
    const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace!.brand_color! : '#004a99';
    try {
      await resend.emails.send({
        from: `${businessName} <invoices@physicaltherapy365.com>`,
        to: businessEmail,
        subject: `[Copy] Invoice ${invoice.invoice_number} sent to ${escapeHtml(invoice.clients?.name || 'client')}`,
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
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Invoice sent notification</p>
        </td>
      </tr>
      <tr>
        <td style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">
            Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> has been successfully sent.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Client</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(invoice.clients?.name || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Email</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${escapeHtml(clientEmail)}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Due Date</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#1e293b;padding-bottom:8px;">${formatDate(invoice.due_date)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#1e293b;padding-top:8px;border-top:1px solid #e2e8f0;">Total</td>
                  <td align="right" style="font-size:18px;font-weight:700;color:${brandColor};padding-top:8px;border-top:1px solid #e2e8f0;">${formatCurrency(invoice.total)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">This is an automated copy for your records. The client has received their own invoice email with payment links.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
      });
    } catch (bizEmailErr) {
      // Non-critical — log but don't fail the request
      console.error('Failed to send business copy email:', bizEmailErr);
    }

    // Update invoice status to sent
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Update invoice error:', updateError);
      return NextResponse.json(
        { error: 'Invoice sent but failed to update status' },
        { status: 500 }
      );
    }

    // Create timeline event
    await supabase.from('timeline_events').insert([
      {
        invoice_id: invoiceId,
        event_type: 'sent',
        description: 'Invoice sent to client',
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
    });
  } catch (err) {
    console.error('POST /api/invoices/[id]/send error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
