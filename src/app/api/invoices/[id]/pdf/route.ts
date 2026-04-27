import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

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
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
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
      .select('*, clients(name, email, address, city, state, zip)')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });

    const items = lineItems || [];
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    const businessName = workspace?.business_name || 'Physical Therapy 365';
    const brandColor = workspace?.brand_color || '#004a99';

    // Parse hex color to RGB
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
      ];
    };

    const brandRgb = hexToRgb(brandColor);

    // Generate PDF using PDFKit
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Invoice ${invoice.invoice_number}`,
        Author: businessName,
        Subject: `Invoice for ${client?.name || 'Client'}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const pageWidth = 512; // 612 - 50 - 50

    // ── Header: brand bar ──────────────────────────────────────────────
    doc
      .save()
      .rect(0, 0, 612, 90)
      .fill(brandColor);

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#ffffff')
      .text(businessName, 50, 30, { width: 300 });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#ffffff')
      .opacity(0.7)
      .text('INVOICE', 400, 28, { width: 162, align: 'right' })
      .opacity(1);

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#ffffff')
      .text(invoice.invoice_number, 400, 42, { width: 162, align: 'right' });

    // Status badge
    if (invoice.status === 'paid') {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#16a34a')
        .text('PAID', 400, 62, { width: 162, align: 'right' });
    } else if (invoice.status === 'overdue') {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#dc2626')
        .text('OVERDUE', 400, 62, { width: 162, align: 'right' });
    }

    // ── Invoice meta ──────────────────────────────────────────────────
    let y = 110;

    // Left: From
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#94a3b8')
      .text('FROM', 50, y);

    y += 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1e293b')
      .text(businessName, 50, y);

    y += 16;
    if (workspace?.address) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(workspace.address, 50, y);
      y += 12;
    }
    if (workspace?.city || workspace?.state || workspace?.zip) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(
          [workspace?.city, workspace?.state, workspace?.zip].filter(Boolean).join(', '),
          50, y
        );
      y += 12;
    }
    if (workspace?.email) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(workspace.email, 50, y);
      y += 12;
    }
    if (workspace?.phone) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(workspace.phone, 50, y);
    }

    // Right: Bill To
    let rightY = 110;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#94a3b8')
      .text('BILL TO', 320, rightY);

    rightY += 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1e293b')
      .text(client?.name || 'Client', 320, rightY);

    rightY += 16;
    if (client?.email) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(client.email, 320, rightY);
      rightY += 12;
    }
    if (client?.address) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(client.address, 320, rightY);
      rightY += 12;
    }

    // ── Date & Due Date row ────────────────────────────────────────────
    y = Math.max(y, rightY) + 20;

    // Date boxes
    doc.rect(50, y, 160, 44).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#94a3b8')
      .text('INVOICE DATE', 60, y + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b')
      .text(formatDate(invoice.created_at), 60, y + 22);

    doc.rect(220, y, 160, 44).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#94a3b8')
      .text('DUE DATE', 230, y + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b')
      .text(formatDate(invoice.due_date), 230, y + 22);

    doc.rect(390, y, 172, 44).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#94a3b8')
      .text('AMOUNT DUE', 400, y + 8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(brandColor)
      .text(formatCurrency(invoice.total), 400, y + 20);

    y += 64;

    // ── Line Items Table ──────────────────────────────────────────────
    // Header row
    const colService = 50;
    const colProvider = 230;
    const colRate = 350;
    const colQty = 420;
    const colAmount = 490;

    doc.rect(50, y, pageWidth, 28).fill('#f1f5f9');

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b');
    doc.text('SERVICE', colService + 10, y + 9);
    doc.text('PROVIDER', colProvider, y + 9);
    doc.text('RATE', colRate, y + 9, { width: 60, align: 'right' });
    doc.text('QTY', colQty, y + 9, { width: 40, align: 'center' });
    doc.text('AMOUNT', colAmount, y + 9, { width: 72, align: 'right' });

    y += 28;

    // Item rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if we need a new page
      if (y > 680) {
        doc.addPage();
        y = 50;
      }

      // Alternate row background
      if (i % 2 === 0) {
        doc.rect(50, y, pageWidth, 32).fill('#ffffff');
      } else {
        doc.rect(50, y, pageWidth, 32).fill('#fafbfc');
      }

      doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
        .text(item.service, colService + 10, y + 8, { width: 170 });

      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(item.provider || '—', colProvider, y + 10, { width: 110 });

      doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
        .text(formatCurrency(Number(item.rate)), colRate, y + 10, { width: 60, align: 'right' });

      doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
        .text(String(item.quantity), colQty, y + 10, { width: 40, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
        .text(formatCurrency(Number(item.amount)), colAmount, y + 10, { width: 72, align: 'right' });

      y += 32;
    }

    // Bottom border
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e2e8f0').lineWidth(1).stroke();

    y += 16;

    // ── Totals ────────────────────────────────────────────────────────
    const totalsX = 390;

    doc.font('Helvetica').fontSize(10).fillColor('#64748b')
      .text('Subtotal', totalsX, y);
    doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
      .text(formatCurrency(invoice.subtotal), colAmount, y, { width: 72, align: 'right' });

    y += 18;

    if (invoice.tax_amount > 0) {
      const taxPercent = invoice.tax_rate > 1
        ? invoice.tax_rate.toFixed(0)
        : (invoice.tax_rate * 100).toFixed(0);
      doc.font('Helvetica').fontSize(10).fillColor('#64748b')
        .text(`Tax (${taxPercent}%)`, totalsX, y);
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
        .text(formatCurrency(invoice.tax_amount), colAmount, y, { width: 72, align: 'right' });
      y += 18;
    }

    // Divider
    doc.moveTo(totalsX, y).lineTo(50 + pageWidth, y).strokeColor('#e2e8f0').lineWidth(1.5).stroke();
    y += 8;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e293b')
      .text('Total Due', totalsX, y);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(brandColor)
      .text(formatCurrency(invoice.total), colAmount - 10, y, { width: 82, align: 'right' });

    y += 30;

    // ── Notes ──────────────────────────────────────────────────────────
    if (invoice.notes) {
      if (y > 680) { doc.addPage(); y = 50; }

      doc.rect(50, y, pageWidth, 4).fill('#f1f5f9');
      y += 14;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#94a3b8')
        .text('NOTES', 50, y);
      y += 14;
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
        .text(invoice.notes, 50, y, { width: pageWidth });
    }

    // ── Footer ─────────────────────────────────────────────────────────
    const footerY = 730;
    doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
      .text(`${businessName} • Generated ${formatDate(new Date().toISOString())}`, 50, footerY + 8, {
        width: pageWidth,
        align: 'center',
      });

    doc.end();

    const pdfBuffer = await pdfReady;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('GET /api/invoices/[id]/pdf error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
