import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { hash } from 'bcryptjs';

const base = process.env.BETTER_AUTH_URL;
if (!base || new URL(base).hostname !== 'localhost') throw new Error('This integration test must run on localhost');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await db.connect();
const users = [];
let keep = false;
const password = randomBytes(24).toString('hex');
const suffix = randomBytes(8).toString('hex');
async function request(path, { method='GET', body, cookie='' } = {}) {
  const response = await fetch(base+path, { method, headers: { 'content-type':'application/json',origin:base,cookie }, body:method === 'GET' ? undefined : JSON.stringify(body || {}), redirect:'manual' });
  const content = await response.text();
  let data; try { data=JSON.parse(content); } catch { data=content; }
  return { status:response.status, data, headers:response.headers, cookie:response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ') };
}
function ok(result, status=200) { assert.equal(result.status,status,`Unexpected status ${result.status}: ${JSON.stringify(result.data).slice(0,180)}`); return result; }
try {
  ok(await request('/api/invoices'),401);
  const first=ok(await request('/api/auth/sign-up/email',{method:'POST',body:{name:'Migration Verification',email:`migration-${suffix}@example.invalid`,password,businessName:'Migration Verification'}}));
  users.push(first.data.user.id);
  assert.ok(first.cookie);
  assert.match(first.headers.get('set-cookie'),/HttpOnly/i);
  // Simulate a migrated account: replace only this synthetic user's hash with bcrypt.
  await db.query('UPDATE public.auth_account SET password=$1 WHERE "userId"=$2',[await hash(password,10),users[0]]);
  const login=ok(await request('/api/auth/sign-in/email',{method:'POST',body:{email:first.data.user.email,password}}));
  const cookie=login.cookie;
  assert.ok(cookie);
  const workspace=ok(await request('/api/workspace',{cookie})).data;
  assert.equal(workspace.user_id,users[0]);
  assert.equal(workspace.business_name,'Migration Verification');
  const second=ok(await request('/api/auth/sign-up/email',{method:'POST',body:{name:'Isolation Verification',email:`isolation-${suffix}@example.invalid`,password,businessName:'Isolation Verification'}}));
  users.push(second.data.user.id);
  const client=ok(await request('/api/clients',{method:'POST',cookie,body:{name:'Migration Test Client',email:`client-${suffix}@example.invalid`}}),201).data;
  const payload={client_id:client.id,tax_rate:0,due_date:'2026-12-31',line_items:[{service:'Migration test service',provider:'Test provider',rate:123.45,quantity:2}]};
  const invoice=ok(await request('/api/invoices',{method:'POST',cookie,body:payload}),201).data;
  assert.equal(Number(invoice.total),246.9);
  const list=ok(await request('/api/invoices',{cookie})).data;
  assert.equal(list.length,1);
  assert.equal(list[0].clients.name,client.name);
  const services=ok(await request('/api/services',{cookie})).data;
  assert.equal(services[0].client_name,client.name);
  assert.equal((ok(await request('/api/invoices',{cookie:second.cookie}))).data.length,0);
  ok(await request(`/api/invoices/${invoice.id}`,{cookie:second.cookie}),404);
  const wrongOwner=await request('/api/invoices',{method:'POST',cookie:second.cookie,body:payload});
  assert.ok([400,403,404].includes(wrongOwner.status));
  const token=(await db.query('SELECT portal_token FROM public.invoices WHERE id=$1',[invoice.id])).rows[0].portal_token;
  const portal=ok(await request(`/api/portal/${token}`)).data;
  assert.equal(Number(portal.total || portal.invoice?.total),246.9);
  ok(await request('/api/portal/invalid-token'),404);
  const duplicate=ok(await request(`/api/invoices/${invoice.id}/duplicate`,{method:'POST',cookie}),201).data;
  assert.notEqual(duplicate.id,invoice.id);
  const pdf=await fetch(base+`/api/invoices/${invoice.id}/pdf`,{headers:{cookie}});
  assert.equal(pdf.status,200);
  assert.match(pdf.headers.get('content-type'),/application\/pdf/);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  const logout=ok(await request('/api/auth/sign-out',{method:'POST',cookie}));
  ok(await request('/api/invoices',{cookie}),401);
  const relogin=ok(await request('/api/auth/sign-in/email',{method:'POST',body:{email:first.data.user.email,password}}));
  const runtime=new pg.Client({connectionString:process.env.DATABASE_URL});await runtime.connect();
  try { await assert.rejects(runtime.query('SELECT * FROM migration_archive.source_snapshot'),/permission denied/); } finally { await runtime.end(); }
  if(process.argv.includes('--keep-fixture')) await writeFile('.vercel/migration-test-account.json',JSON.stringify({users,email:first.data.user.email,password,invoiceId:invoice.id,token}),{mode:0o600});
  keep=process.argv.includes('--keep-fixture');
  console.log('PASS: bcrypt login, HttpOnly sessions, workspace creation, invoices, joins, account isolation, portal, PDF, duplication, logout revocation, and archive permissions. No payment or email was sent.');
} finally {
  if(!keep) for(const id of users.reverse()) {
    await db.query('DELETE FROM public.invoices WHERE user_id=$1',[id]);
    await db.query('DELETE FROM public.clients WHERE user_id=$1',[id]);
    await db.query('DELETE FROM public.auth_user WHERE id=$1',[id]);
  }
  await db.end();
}
