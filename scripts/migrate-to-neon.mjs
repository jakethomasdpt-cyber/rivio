import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = process.argv[2];
if (!folder || !process.argv.includes('--apply')) throw new Error('Usage: node --env-file=.env.local scripts/migrate-to-neon.mjs PRIVATE_EXPORT_FOLDER --apply');
const url = new URL(process.env.DATABASE_URL_UNPOOLED || '');
if (!/\.neon\.(tech|build)$/.test(url.hostname) || url.hostname.includes('-pooler')) throw new Error('Use a direct Neon connection for migration');
url.searchParams.set('sslmode', 'verify-full');
const schema = JSON.parse(await readFile(resolve(folder, 'schema.json'), 'utf8'));
const data = JSON.parse(await readFile(resolve(folder, 'data.json'), 'utf8'));
const business = schema.tables.filter(t => t.schema === 'public' && t.kind === 'r');
const users = data['auth.users'];
if (!users?.length || !data['public.invoices']?.length) throw new Error('Refusing to migrate an empty or incomplete Rivio export');
if (data['storage.objects']?.length || data['auth.mfa_factors']?.length) throw new Error('Storage/MFA need a separate migration before proceeding');
if (data['auth.identities'].some(i => i.provider !== 'email')) throw new Error('Configure all source identity providers first');
for (const u of users) {
  if (!u.email || u.deleted_at || u.banned_until || u.is_anonymous || !/^\$2[aby]\$/.test(u.encrypted_password)) throw new Error('Unsupported user status/password: review source accounts before proceeding');
}
const quote = value => '"' + value.replaceAll('"', '""') + '"';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const digest = rows => createHash('sha256').update(JSON.stringify(rows.map(r => JSON.stringify(canonical(r))).sort())).digest('hex');
const db = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
await db.connect();
try {
  if ((await db.query("SELECT to_regclass('public.invoices') AS existing")).rows[0].existing) throw new Error('Target already contains Rivio tables; refusing to overwrite');
  await db.query('BEGIN');
  await db.query("SET LOCAL timezone = 'UTC'");
  await db.query(await readFile(resolve(root, 'database/001-auth.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'database/002-business.sql'), 'utf8'));
  // Keep the complete original export, including historical auth records, private.
  await db.query('CREATE SCHEMA migration_archive; REVOKE ALL ON SCHEMA migration_archive FROM PUBLIC');
  await db.query('CREATE TABLE migration_archive.source_snapshot (id integer PRIMARY KEY, schema jsonb NOT NULL, data jsonb NOT NULL, captured_at timestamptz DEFAULT now())');
  await db.query('INSERT INTO migration_archive.source_snapshot (id,schema,data) VALUES (1,$1::jsonb,$2::jsonb)', [JSON.stringify(schema),JSON.stringify(data)]);
  for (const u of users) {
    await db.query('INSERT INTO public.auth_user (id,name,email,"emailVerified","createdAt","updatedAt","businessName") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [u.id,u.raw_user_meta_data?.full_name || u.email,u.email,Boolean(u.email_confirmed_at),u.created_at,u.updated_at || u.created_at,u.raw_user_meta_data?.business_name || 'My Business']);
    await db.query('INSERT INTO public.auth_account (id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES ($1,$2,$6,\'credential\',$3,$4,$5)',
      [randomUUID(),u.id,u.encrypted_password,u.created_at,u.updated_at || u.created_at,u.id]);
  }
  // Topologically order FK dependencies; never disable constraint enforcement.
  const pending = new Set(business.map(t => t.name));
  const imported = new Set(['auth_user']);
  while (pending.size) {
    let progressed = false;
    for (const table of pending) {
      const deps = schema.constraints.filter(c => c.table === table && c.type === 'f').map(c => /REFERENCES (?:public\.)?(\w+)/.exec(c.definition)?.[1]).filter(t => pending.has(t) && t !== table);
      if (deps.length) continue;
      const rows = data['public.' + table];
      if (!Array.isArray(rows)) throw new Error('Missing exported table: ' + table);
      if (rows.length) await db.query(`INSERT INTO public.${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::public.${quote(table)}, $1::jsonb)`, [JSON.stringify(rows)]);
      pending.delete(table); imported.add(table); progressed = true;
    }
    if (!progressed) throw new Error('Unresolved foreign key cycle');
  }
  const report = { source: 'rsgkhgogmlsumvcykwro', verifiedAt: new Date().toISOString(), users: users.length, tables: {} };
  for (const { name } of business) {
    const rows = (await db.query(`SELECT to_jsonb(t) AS value FROM public.${quote(name)} t`)).rows.map(r => r.value);
    const expected = digest(data['public.' + name]);
    const actual = digest(rows);
    if (actual !== expected) throw new Error('Record verification failed: ' + name);
    report.tables[name] = { rows: rows.length, sha256: actual };
  }
  const accounts = (await db.query('SELECT u.id,u.email,a.password FROM public.auth_user u JOIN public.auth_account a ON a."userId"=u.id')).rows;
  if (accounts.length !== users.length || accounts.some(a => !users.some(u => u.id===a.id && u.email===a.email && u.encrypted_password===a.password))) throw new Error('Account verification failed');
  await db.query(await readFile(resolve(root, 'database/003-workspace-trigger.sql'), 'utf8'));
  for (const { name } of business) await db.query(`ALTER TABLE public.${quote(name)} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.${quote(name)} FROM PUBLIC`);
  for (const name of ['auth_user','auth_account','auth_session','auth_verification','auth_rate_limit']) await db.query(`ALTER TABLE public.${quote(name)} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.${quote(name)} FROM PUBLIC`);
  await db.query('COMMIT');
  await writeFile(resolve(folder, 'verification.json'), JSON.stringify(report,null,2)+'\n', { mode: 0o600 });
  console.log(JSON.stringify({ verified: true, users: report.users, tables: Object.fromEntries(Object.entries(report.tables).map(([k,v])=>[k,v.rows])) }));
} catch (error) {
  await db.query('ROLLBACK');
  console.error('Migration stopped:',error.message);
  process.exitCode = 1;
} finally { await db.end(); }
