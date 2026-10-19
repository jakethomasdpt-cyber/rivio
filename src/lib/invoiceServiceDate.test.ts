import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { invoiceServiceDateLabel, invoiceServiceDate } from './invoiceServiceDate.ts';

test('historical Veda metadata renders each service date without shifting calendar days', () => {
  for (const day of ['08', '17', '18', '19']) {
    assert.equal(invoiceServiceDateLabel({ veda_metadata: { serviceDate: `2026-10-${day}` } }), `Service date: 10/${day}/2026`);
  }
});
test('native dates take precedence, invalid and missing dates never become invoice dates', () => {
  assert.equal(invoiceServiceDate({ service_date: '2026-10-19', veda_metadata: { serviceDate: '2026-10-18' } }), '2026-10-19');
  assert.equal(invoiceServiceDateLabel({ service_date: '2024-02-29' }), 'Service date: 02/29/2024');
  for (const value of [undefined, null, '', '2026-02-29', '2026-02-30', '2026-13-01', '2026-10-19T00:00:00Z']) {
    assert.equal(invoiceServiceDateLabel({ veda_metadata: { serviceDate: value } }), null);
  }
  assert.equal(invoiceServiceDateLabel({}), null);
});
test('portal, invoice PDF and dashboard use the shared date label; portal exposes actual joined client', () => {
  for (const path of ['src/app/portal/[token]/page.tsx', 'src/app/api/invoices/[id]/pdf/route.ts', 'src/app/dashboard/invoices/page.tsx']) {
    assert.match(readFileSync(path, 'utf8'), /invoiceServiceDateLabel\(item\)/);
  }
  assert.match(readFileSync('src/app/api/portal/[token]/route.ts', 'utf8'), /client: client \?\? null/);
});
