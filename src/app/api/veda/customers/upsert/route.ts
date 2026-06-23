import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  authenticateVedaRequest,
  emitVedaCustomerEvent,
  getIdempotentResponse,
  hostedCustomerUrl,
  resolveVedaTenant,
  storeIdempotentResponse,
} from '@/lib/vedaIntegration';

export const dynamic = 'force-dynamic';

function normalizeEmail(email: unknown): string | null {
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

export async function POST(request: NextRequest) {
  const auth = await authenticateVedaRequest(request);
  if (!auth.ok) return auth.response;

  const idempotencyKey = request.headers.get('idempotency-key');
  const scope = 'veda.customer.upsert';
  const cached = await getIdempotentResponse(scope, idempotencyKey);
  if (cached) return cached;

  try {
    const body = auth.body;
    const vedaOrganizationId = requireString(body.vedaOrganizationId, 'vedaOrganizationId');
    const vedaPatientId = requireString(body.vedaPatientId, 'vedaPatientId');
    const name = requireString(body.name || body.patientName, 'name');
    const email = normalizeEmail(body.email);
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    const address = body.address && typeof body.address === 'object' ? body.address : {};
    const dob = typeof body.dob === 'string' && body.dob ? body.dob : null;

    const tenant = await resolveVedaTenant(vedaOrganizationId);
    if (!tenant) {
      return NextResponse.json({ error: 'Unknown or inactive Veda organization mapping' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { data: existingLink } = await supabase
      .from('veda_integration_customers')
      .select('id, client_id, rivio_customer_id')
      .eq('veda_organization_id', vedaOrganizationId)
      .eq('veda_patient_id', vedaPatientId)
      .single();

    let clientId = existingLink?.client_id as string | undefined;

    if (clientId) {
      const { error: updateClientError } = await supabase
        .from('clients')
        .update({
          name,
          email,
          phone,
          address: typeof address.line1 === 'string' ? address.line1 : null,
          city: typeof address.city === 'string' ? address.city : null,
          state: typeof address.state === 'string' ? address.state : null,
          zip: typeof address.postalCode === 'string' ? address.postalCode : null,
        })
        .eq('id', clientId)
        .eq('user_id', tenant.user_id);

      if (updateClientError) throw updateClientError;
    } else {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: tenant.user_id,
          name,
          email,
          phone,
          address: typeof address.line1 === 'string' ? address.line1 : null,
          city: typeof address.city === 'string' ? address.city : null,
          state: typeof address.state === 'string' ? address.state : null,
          zip: typeof address.postalCode === 'string' ? address.postalCode : null,
        })
        .select('id')
        .single();

      if (clientError || !client) throw clientError || new Error('Failed to create client');
      clientId = client.id;
    }

    const { data: link, error: linkError } = await supabase
      .from('veda_integration_customers')
      .upsert(
        {
          veda_organization_id: vedaOrganizationId,
          veda_patient_id: vedaPatientId,
          rivio_customer_id: clientId,
          client_id: clientId,
          user_id: tenant.user_id,
          patient_name: name,
          patient_email: email,
          patient_phone: phone,
          patient_dob: dob,
          patient_address: address,
          metadata: body.metadata || {},
        },
        { onConflict: 'veda_organization_id,veda_patient_id' }
      )
      .select('rivio_customer_id')
      .single();

    if (linkError || !link) throw linkError || new Error('Failed to upsert Veda customer');

    const responseBody = {
      rivioCustomerId: link.rivio_customer_id,
      hostedCustomerUrl: hostedCustomerUrl(link.rivio_customer_id),
    };

    await storeIdempotentResponse(scope, idempotencyKey, 200, responseBody);

    await emitVedaCustomerEvent({
      vedaOrganizationId,
      vedaPatientId,
      rivioCustomerId: link.rivio_customer_id,
      metadata: body.metadata || {},
    }).catch(() => undefined);

    return NextResponse.json(responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upsert Veda customer';
    const status = message.includes('required') ? 400 : 500;
    console.error('POST /api/veda/customers/upsert error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
