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
  const stripeLinkUrl = `${appUrl}/portal/${portalToken}`;

  const businessName = escapeHtml(workspace?.business_name || 'Your Provider');
  const venmoHandle = escapeHtml(workspace?.venmo_handle || '');
  const zelleContact = escapeHtml(workspace?.zelle_phone || '');
  // Strip non-hex-color characters to prevent CSS injection
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace.brand_color : '#2563eb';

  const venmoDeepLink = venmoHandle
    ? `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${invoice.total}&note=${encodeURIComponent('Invoice ' + invoice.invoice_number)}`
    : '';

  const lineItemsHTML = lineItems
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left; font-size: 14px;">${escapeHtml(item.service)}</td>
      <td style="padding: 12px; text-align: left; font-size: 14px;">${escapeHtml(item.provider)}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${formatCurrency(Number(item.rate) || 0)}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${Number(item.quantity) || 0}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600;">${formatCurrency(Number(item.amount) || 0)}</td>
    </tr>
  `
    )
    .join('');

  const paymentMethodsHTML = [
    `<a href="${stripeLinkUrl}" target="_blank" style="display: block; background-color: ${brandColor}; color: #ffffff; padding: 12px 16px; text-align: center; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Pay with Card</a>`,
    ...(venmoHandle ? [`<a href="${venmoDeepLink}" style="display: block; background-color: #3d95ce; color: #ffffff; padding: 12px 16px; text-align: center; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Pay with Venmo</a>`] : []),
    ...(zelleContact ? [`<p style="display: block; background-color: #6b7280; color: #ffffff; padding: 12px 16px; text-align: center; border-radius: 6px; font-size: 14px; font-weight: 600; margin: 0;">Pay via Zelle: Send to ${zelleContact}</p>`] : []),
  ].join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background-color: ${brandColor}; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${businessName}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <!-- Invoice Title -->
      <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 20px; font-weight: 600;">Invoice</h2>

      <!-- Invoice Details Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
        <div>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Invoice Number</p>
          <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">${escapeHtml(invoice.invoice_number)}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Invoice Date</p>
          <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">${formatDate(invoice.created_at)}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Due Date</p>
          <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">${formatDate(invoice.due_date)}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Status</p>
          <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600; text-transform: capitalize;">${invoice.status}</p>
        </div>
      </div>

      <!-- Bill To -->
      <div style="margin-bottom: 32px;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Bill To</p>
        <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">${escapeHtml(client.name)}</p>
        ${client.email ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">${escapeHtml(client.email)}</p>` : ''}
      </div>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <thead>
          <tr style="border-bottom: 2px solid ${brandColor};">
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Service</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Provider</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Rate</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="border-top: 2px solid ${brandColor}; padding-top: 16px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
          <div style="width: 200px;">
            <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
              <span>Subtotal:</span>
              <span>${formatCurrency(invoice.subtotal)}</span>
            </div>
            ${invoice.tax_rate > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
              <span>Tax (${(invoice.tax_rate * 100).toFixed(0)}%):</span>
              <span>${formatCurrency(invoice.tax_amount)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; color: #1f2937; font-size: 18px; font-weight: 700; border-top: 1px solid #e5e7eb; padding-top: 8px;">
              <span>Total:</span>
              <span>${formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      ${invoice.notes ? `
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 32px;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Notes</p>
        <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${escapeHtml(invoice.notes)}</p>
      </div>
      ` : ''}

      <!-- Payment Methods -->
      <div style="margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Payment Methods:</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${paymentMethodsHTML}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        <strong>${businessName}</strong>
      </p>
      <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 11px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
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
      reply_to: 'jakethomasdpt@gmail.com',
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

    // Update invoice status to sent
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

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
