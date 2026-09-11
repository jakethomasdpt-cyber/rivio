import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseQuery } from './database-query.ts';
const unused = async () => ({ rows: [], rowCount: 0 });
test('client values remain parameters, including SQL metacharacters', () => {
  const value = "x' OR true; DROP TABLE invoices; --";
  const result = new DatabaseQuery('invoices', unused).select('id').eq('user_id', value).compile();
  assert.equal(result.sql.includes(value), false);
  assert.deepEqual(result.values, [value]);
});
test('related service queries keep the account filter on the joined invoice', () => {
  const result = new DatabaseQuery('line_items', unused).select('service,invoices!inner(user_id,clients(name))').eq('invoices.user_id','owner').compile();
  assert.match(result.sql, /INNER JOIN public\."invoices"/);
  assert.match(result.sql, /WHERE "record_invoices"\."user_id" = \$1/);
  assert.deepEqual(result.values,['owner']);
});
test('unscoped updates and malformed identifiers are rejected', () => {
  assert.throws(() => new DatabaseQuery('invoices',unused).update({ status:'paid' }).compile());
  assert.throws(() => new DatabaseQuery('auth_user',unused));
  assert.throws(() => new DatabaseQuery('invoices',unused).select('id;DELETE').compile());
});
test('empty IN never removes the filter and undefined filters fail closed', () => {
  assert.match(new DatabaseQuery('invoices',unused).in('id',[]).compile().sql,/WHERE FALSE/);
  assert.throws(() => new DatabaseQuery('invoices',unused).eq('user_id',undefined));
});
test('single refuses duplicate results and preserves missing-row semantics', async () => {
  assert.equal((await new DatabaseQuery('clients',unused).single()).error?.code,'PGRST116');
  const duplicate = async () => ({rows:[{id:'1'},{id:'2'}],rowCount:2});
  assert.equal((await new DatabaseQuery('clients',duplicate).single()).error?.code,'PGRST116');
});
test('upsert retains composite conflict targets and parameterizes JSON', () => {
  const value = { scope:'charge',key:'key',response_body:{paid:true} };
  const result = new DatabaseQuery('idempotency_keys',unused).upsert(value,{onConflict:'scope,key'}).compile();
  assert.match(result.sql,/ON CONFLICT \("scope", "key"\) DO UPDATE/);
  assert.deepEqual(result.values,[value.scope,value.key,JSON.stringify(value.response_body)]);
});
test('JSON array metadata is encoded as JSON rather than a PostgreSQL array', () => {
  const result = new DatabaseQuery('invoices',unused).update({veda_metadata:[{source:'test'}]}).eq('id','invoice').compile();
  assert.equal(result.values[0],'[{"source":"test"}]');
});
