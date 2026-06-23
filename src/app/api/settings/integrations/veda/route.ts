import { NextRequest, NextResponse } from 'next/server';
import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import {
  ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME,
  getAppUrl,
  isPhysicalTherapy365Workspace,
} from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getWorkspaceForUser(userId: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from('workspaces')
    .select('id, user_id, business_name')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as { id: string; user_id: string; business_name: string };
}

function integrationConfig() {
  const appUrl = getAppUrl();
  return {
    allowedRivioOrganizationName: ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME,
    endpoints: {
      customerUpsert: `${appUrl}/api/veda/customers/upsert`,
      invoiceCreate: `${appUrl}/api/veda/invoices`,
      invoiceStatus: `${appUrl}/api/veda/invoices/{rivioInvoiceId}`,
      invoiceSend: `${appUrl}/api/veda/invoices/{rivioInvoiceId}/send`,
      invoiceVoid: `${appUrl}/api/veda/invoices/{rivioInvoiceId}/void`,
      outboundWebhook: process.env.VEDA_WEBHOOK_BASE_URL
        ? `${process.env.VEDA_WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/rivio/webhook`
        : 'Not configured',
    },
    secrets: {
      vedaToRivioSharedSecretConfigured: Boolean(process.env.VEDA_RIVIO_SHARED_SECRET),
      rivioToVedaWebhookSecretConfigured: Boolean(process.env.RIVIO_VEDA_WEBHOOK_SECRET),
      vedaToRivioSharedSecret: process.env.VEDA_RIVIO_SHARED_SECRET ? '••••••••••••••••' : 'Not configured',
      rivioToVedaWebhookSecret: process.env.RIVIO_VEDA_WEBHOOK_SECRET ? '••••••••••••••••' : 'Not configured',
    },
    webhookBaseUrl: process.env.VEDA_WEBHOOK_BASE_URL || '',
  };
}

async function loadState(userId: string) {
  const db = createServerSupabaseClient();
  const workspace = await getWorkspaceForUser(userId);
  const isAllowedWorkspace = isPhysicalTherapy365Workspace(workspace?.business_name);

  const { data: mappings } = await db
    .from('veda_organization_mappings')
    .select('veda_organization_id, display_name, webhook_base_url, notes, is_active, deleted_at, created_at, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { data: vedaInvoices } = await db
    .from('invoices')
    .select('id')
    .eq('user_id', userId)
    .not('veda_invoice_id', 'is', null);

  const invoiceIds = (vedaInvoices || []).map((invoice) => invoice.id);
  const failedDeliveriesQuery = db
    .from('webhook_deliveries')
    .select('id, event_id, invoice_id, destination_url, status, attempt_count, response_status, last_error, next_retry_at, created_at, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20);

  const { data: failedDeliveries } = invoiceIds.length
    ? await failedDeliveriesQuery.in('invoice_id', invoiceIds)
    : { data: [] };

  return {
    workspace,
    isAllowedWorkspace,
    connections: mappings || [],
    failedWebhookDeliveries: failedDeliveries || [],
    config: integrationConfig(),
  };
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await loadState(user.id));
  } catch (err) {
    console.error('GET /api/settings/integrations/veda error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspace = await getWorkspaceForUser(user.id);
    if (!isPhysicalTherapy365Workspace(workspace?.business_name)) {
      return NextResponse.json(
        { error: `Veda EMR can only be connected from ${ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME}.` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const vedaOrganizationId = String(body.vedaOrganizationId || '').trim();
    const displayName = String(body.displayName || 'Veda EMR').trim();
    const webhookBaseUrl = String(body.webhookBaseUrl || '').trim();
    const notes = String(body.notes || '').trim();

    if (!vedaOrganizationId) {
      return NextResponse.json({ error: 'Veda organization ID is required' }, { status: 400 });
    }

    const db = createServerSupabaseClient();
    const { error } = await db.from('veda_organization_mappings').upsert(
      {
        veda_organization_id: vedaOrganizationId,
        display_name: displayName || 'Veda EMR',
        user_id: user.id,
        workspace_id: workspace?.id,
        webhook_base_url: webhookBaseUrl || process.env.VEDA_WEBHOOK_BASE_URL || null,
        notes: notes || null,
        is_active: true,
        deleted_at: null,
      },
      { onConflict: 'veda_organization_id' }
    );

    if (error) {
      console.error('Create Veda mapping error:', error);
      return NextResponse.json({ error: 'Failed to save Veda connection' }, { status: 500 });
    }

    return NextResponse.json(await loadState(user.id), { status: 201 });
  } catch (err) {
    console.error('POST /api/settings/integrations/veda error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspace = await getWorkspaceForUser(user.id);
    if (!isPhysicalTherapy365Workspace(workspace?.business_name)) {
      return NextResponse.json(
        { error: `Veda EMR can only be managed from ${ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME}.` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const vedaOrganizationId = String(body.vedaOrganizationId || '').trim();
    if (!vedaOrganizationId) {
      return NextResponse.json({ error: 'Veda organization ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;
    if (typeof body.displayName === 'string') updates.display_name = body.displayName.trim() || 'Veda EMR';
    if (typeof body.webhookBaseUrl === 'string') updates.webhook_base_url = body.webhookBaseUrl.trim() || null;
    if (typeof body.notes === 'string') updates.notes = body.notes.trim() || null;

    const db = createServerSupabaseClient();
    const { error } = await db
      .from('veda_organization_mappings')
      .update(updates)
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Update Veda mapping error:', error);
      return NextResponse.json({ error: 'Failed to update Veda connection' }, { status: 500 });
    }

    return NextResponse.json(await loadState(user.id));
  } catch (err) {
    console.error('PATCH /api/settings/integrations/veda error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspace = await getWorkspaceForUser(user.id);
    if (!isPhysicalTherapy365Workspace(workspace?.business_name)) {
      return NextResponse.json(
        { error: `Veda EMR can only be managed from ${ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME}.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const vedaOrganizationId = String(searchParams.get('vedaOrganizationId') || '').trim();
    if (!vedaOrganizationId) {
      return NextResponse.json({ error: 'Veda organization ID is required' }, { status: 400 });
    }

    const db = createServerSupabaseClient();
    const { error } = await db
      .from('veda_organization_mappings')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete Veda mapping error:', error);
      return NextResponse.json({ error: 'Failed to delete Veda connection' }, { status: 500 });
    }

    return NextResponse.json(await loadState(user.id));
  } catch (err) {
    console.error('DELETE /api/settings/integrations/veda error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
