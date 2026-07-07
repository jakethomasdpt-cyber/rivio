import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';

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

async function getUser() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function generateReminderEmailHTML(invoice: any, client: any, portalToken: string, workspace: any): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const portalUrl = `${appUrl}/portal/${portalToken}`;
  const businessName = escapeHtml(workspace?.business_name || 'Your Provider');
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '') ? workspace.brand_color : '#1d4ed8';
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
  const dueLine = daysPastDue > 0
    ? `This invoice is <strong style="color:#b91c1c;">${daysPastDue} day${daysPastDue === 1 ? '' : 's'} past due</strong>.`
    : `This invoice is due on <strong style="color:#1e293b;">${formatDate(invoice.due_date)}</strong>.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reminder for invoice ${escapeHtml(invoice.invoice_number)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr>
          <td style="background:${brandColor};border-radius:12px 12px 0 0;padding:28px 36px;">
            <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;">${businessName}</p>
            <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.08em;">Invoice reminder</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:32px 36px;">
            <p style="margin:0 0 12px;font-size:16px;color:#475569;">Hi ${escapeHtml(client?.name || 'there')},</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#64748b;">
              This is a friendly reminder that invoice <strong style="color:#1e293b;">${escapeHtml(invoice.invoice_number)}</strong>
              from <strong style="color:#1e293b;">${businessName}</strong> still has a balance due.
              ${dueLine}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 20px;font-size:13px;color:#64748b;">Amount due</td>
                <td align="right" style="padding:18px 20px;font-size:22px;font-weight:800;color:${brandColor};">${formatCurrency(invoice.total)}</td>
              </tr>
              <tr>
                <td style="padding:0 20px 18px;font-size:13px;color:#64748b;">Due date</td>
                <td align="right" style="padding:0 20px 18px;font-size:14px;font-weight:700;color:#1e293b;">${formatDate(invoice.due_date)}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${portalUrl}" target="_blank" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;min-width:220px;text-align:center;">
                    View &amp; Pay Invoice
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
              If you already paid, thank you. You can disregard this reminder.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Questions? Reply to this email and ${businessName} will get back to you.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const supabase = createServerSupabaseClient();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients(name, email)')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (['draft', 'paid', 'cancelled'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Reminders can only be sent for open invoices that have already been sent.' },
        { status: 400 }
      );
    }

    const clientEmail = invoice.clients?.email;
    if (!clientEmail) {
      return NextResponse.json({ error: 'Client does not have an email address' }, { status: 400 });
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let portalToken = invoice.portal_token;
    if (!portalToken) {
      portalToken = randomBytes(32).toString('hex');
      await supabase
        .from('invoices')
        .update({
          portal_token: portalToken,
          portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', invoiceId)
        .eq('user_id', user.id);
    }

    const businessName = workspace?.business_name || 'Your Provider';
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: `${businessName} <invoices@physicaltherapy365.com>`,
      replyTo: workspace?.email || 'jakethomasdpt@gmail.com',
      to: clientEmail,
      subject: `Reminder: invoice ${invoice.invoice_number} from ${businessName}`,
      html: generateReminderEmailHTML(invoice, invoice.clients, portalToken, workspace),
    });

    if (emailError) {
      console.error('Resend reminder email error:', emailError);
      return NextResponse.json({ error: 'Failed to send reminder email' }, { status: 500 });
    }

    await supabase.from('timeline_events').insert([
      {
        invoice_id: invoiceId,
        event_type: 'reminder_sent',
        description: 'Payment reminder sent to client',
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      recipient: clientEmail,
    });
  } catch (err) {
    console.error('POST /api/invoices/[id]/remind error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
