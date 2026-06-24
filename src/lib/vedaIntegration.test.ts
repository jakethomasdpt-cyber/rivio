import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPhysicalTherapy365Workspace } from './vedaWorkspace.ts';

test('Physical Therapy 365 workspace gate accepts the legal PT365 workspace name', () => {
  assert.equal(isPhysicalTherapy365Workspace('PHYSICAL THERAPY 365 LLC'), true);
  assert.equal(isPhysicalTherapy365Workspace('Physical Therapy 365'), true);
});

test('Physical Therapy 365 workspace gate rejects unrelated workspaces', () => {
  assert.equal(isPhysicalTherapy365Workspace('Another Therapy Clinic LLC'), false);
  assert.equal(isPhysicalTherapy365Workspace('Physical Therapy 364 LLC'), false);
});

test('Veda manual card charge endpoint uses HMAC auth, idempotency, Stripe, and callbacks', () => {
  const route = readFileSync('src/app/api/veda/payments/charge/route.ts', 'utf8');
  assert.match(route, /authenticateVedaRequest\(request\)/);
  assert.match(route, /resolveVedaTenant\(vedaOrganizationId\)/);
  assert.match(route, /getIdempotentResponse\(scope, idempotencyKey\)/);
  assert.match(route, /storeIdempotentResponse\(scope, idempotencyKey/);
  assert.match(route, /paymentMethod\.paymentMethodId is required/);
  assert.match(route, /stripe\.paymentMethods\.retrieve\(paymentMethodId\)/);
  assert.doesNotMatch(route, /stripe\.paymentMethods\.create/);
  assert.doesNotMatch(route, /normalizeCard/);
  assert.match(route, /stripe\.paymentIntents\.create/);
  assert.match(route, /confirm: true/);
  assert.match(route, /payment_attempts/);
  assert.match(route, /eventType: 'invoice\.paid'/);
  assert.match(route, /eventType: 'invoice\.payment_failed'/);
  assert.doesNotMatch(route, /Resend/);
});
