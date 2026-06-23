import assert from 'node:assert/strict';
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
