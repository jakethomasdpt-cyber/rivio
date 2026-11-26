import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { register } from 'tsx/cjs/api';
import type Stripe from 'stripe';
import { parseAdditionalPayment } from './portalPaymentAmounts.ts';

const require = createRequire(import.meta.url);

// Load the actual App Router handler, substituting only the DB and the external
// checkout operation. The line items and metadata come directly from the handler.
test('patient checkout charges the configured percentage only on the invoice balance', async (t) => {
  const invoice = { id: 'invoice', user_id: 'clinic', total: 100, status: 'sent', accept_ach: true, accept_wallet: true };
  const workspace = { surcharge_enabled: true, card_surcharge_rate: 3, surcharge_label: 'Card fee' };
  const invoiceItems = [{ service: 'Therapy visit', quantity: 1, rate: 100 }];
  const sessions: Stripe.Checkout.SessionCreateParams[] = [];
  const db = {
    from(table: string) {
      const rows: Record<string, unknown> = { invoices: invoice, line_items: invoiceItems, workspaces: workspace };
      assert.ok(table in rows, table);
      return { select: () => ({ eq: () => ({
        data: rows[table],
        single: async () => ({ data: rows[table] }),
      }) }) };
    },
  };

  function substitute(specifier: string, exports: object) {
    const id = require.resolve(specifier);
    const original = require.cache[id];
    const replacement = new Module(id);
    replacement.exports = exports;
    replacement.loaded = true;
    require.cache[id] = replacement;
    t.after(() => {
      if (original) require.cache[id] = original;
      else delete require.cache[id];
    });
  }

  substitute('./database.ts', { createDatabaseClient: () => db, getDatabasePool: () => ({}) });
  substitute('./invoicePaymentSafety.ts', {
    InvoicePaymentConflict: class extends Error {},
    async createCheckoutForLockedInvoice(
      _pool: unknown, _stripe: unknown, _id: string, expected: { total: number }, params: Stripe.Checkout.SessionCreateParams,
    ) {
      assert.equal(expected.total, 100);
      sessions.push(params);
      return { url: 'https://example.test/checkout' };
    },
  });
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  t.after(() => {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  const unregister = register();
  t.after(unregister);
  const { POST } = require('../app/api/portal/[token]/checkout/route.ts');
  async function checkout(method: string, additional?: unknown) {
    const body = JSON.stringify({ payment_method: method, additional_payment_cents: additional });
    return POST(new Request('https://example.test/api/portal/token/checkout', { method: 'POST', body }), {
      params: Promise.resolve({ token: 'token' }),
    });
  }

  for (const [method, extra, expectedFee, expectedTotal] of [
    ['card', undefined, 300, 10300], // Existing callers omit the field.
    ['card', 2000, 300, 12300],
    ['card', 0, 300, 10300], // Patient clears the amount.
    ['card', 1, 300, 10301],
    ['wallet', 2000, 300, 12300],
    ['ach', undefined, 0, 10000],
    ['ach', 2000, 0, 12000],
    ['ach', 0, 0, 10000],
  ] as const) {
    const before = sessions.length;
    const response = await checkout(method, extra);
    assert.equal(response.status, 200, await response.text());
    assert.equal(sessions.length, before + 1);
    const session = sessions[before];
    const items = session.line_items!;
    const fee = items.find(item => item.price_data?.product_data?.name === 'Card fee');
    assert.equal(fee?.price_data?.unit_amount ?? 0, expectedFee);
    assert.equal(items.reduce((sum, item) => sum + item.quantity! * item.price_data!.unit_amount!, 0), expectedTotal);
    const extraItem = items.find(item => /additional payment/i.test(item.price_data?.product_data?.name ?? ''));
    assert.equal(extraItem?.price_data?.unit_amount ?? 0, extra ?? 0);
    assert.equal(Boolean(extraItem), Boolean(extra));
    for (const metadata of [session.metadata, session.payment_intent_data?.metadata]) {
      assert.equal(Number(metadata?.surcharge_amount), expectedFee / 100);
      assert.equal(Number(metadata?.additional_payment_cents ?? 0), extra ?? 0);
    }
  }

  const validRequests = sessions.length;
  for (const invalid of [-1, 1.5, '2000', 99_999_999]) {
    assert.equal((await checkout('card', invalid)).status, 400);
  }
  invoice.accept_ach = false;
  assert.equal((await checkout('ach', 2000)).status, 400, 'a disabled ACH method cannot fall back to card');
  assert.equal(sessions.length, validRequests, 'invalid requests must never create a Stripe session');
});

test('patient-entered dollars convert to exact cents and clearing the field removes the extra', () => {
  for (const [input, expected] of [
    ['', 0], ['0.00', 0], ['20', 2000], ['.01', 1], ['20.05', 2005], ['1.2', 120],
    ['-1', null], ['1e3', null], ['20.005', null], ['1,20', null], ['1000000', null],
  ] as const) {
    assert.equal(parseAdditionalPayment(input), expected, JSON.stringify(input));
  }
});
