// A deliberately small, parameterized SQL adapter for Rivio's existing queries.
// It is server-only through database.ts; no browser database endpoint is exposed.
export type Row = Record<string, any>;
export type Executor = (sql: string, values: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }>;
type Result<T> = { data: T; error: null } | { data: null; error: { message: string; code?: string; constraint?: string } };
const tables = new Set(['clients', 'invoices', 'line_items', 'timeline_events', 'workspaces',
  'bank_statements', 'bank_transactions', 'mileage_trips', 'veda_organization_mappings',
  'veda_integration_customers', 'payment_attempts', 'invoice_events', 'webhook_deliveries', 'idempotency_keys']);
const relations: Record<string, Record<string, string>> = {
  invoices: { clients: 'client_id' }, line_items: { invoices: 'invoice_id' },
};
const jsonColumns: Record<string, string[]> = {
  idempotency_keys: ['response_body'], invoice_events: ['payload'], invoices: ['veda_metadata'],
  line_items: ['veda_metadata'], payment_attempts: ['metadata'], timeline_events: ['metadata'],
  veda_integration_customers: ['patient_address', 'metadata'], webhook_deliveries: ['request_body'],
};
function ident(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid SQL identifier');
  return `"${value}"`;
}
function splitSelection(value: string): string[] {
  const result: string[] = []; let depth = 0; let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (depth < 0) throw new Error('Invalid selection');
    if (value[i] === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
  }
  if (depth) throw new Error('Invalid selection');
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}
type Filter = { column: string; op: string; value: unknown };
export class DatabaseQuery<T = Row[]> implements PromiseLike<Result<T>> {
  private operation = 'select';
  private selection = '*';
  private returning = false;
  private payload: Row[] = [];
  private filters: Filter[] = [];
  private ordering: { column: string; ascending: boolean }[] = [];
  private maximum?: number;
  private cardinality: 'many' | 'one' | 'optional' = 'many';
  private conflict?: string;
  private ignoreDuplicates = false;
  private pending?: Promise<Result<T>>;
  private table: string;
  private execute: Executor;
  constructor(table: string, execute: Executor) {
    this.table = table;
    this.execute = execute;
    if (!tables.has(table)) throw new Error('Unknown application table');
  }
  select(selection = '*') { this.selection = selection; this.returning = true; return this; }
  insert(value: Row | Row[]) { this.operation = 'insert'; this.payload = Array.isArray(value) ? value : [value]; return this; }
  upsert(value: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.insert(value); this.operation = 'upsert'; this.conflict = options?.onConflict || 'id';
    this.ignoreDuplicates = options?.ignoreDuplicates || false; return this;
  }
  update(value: Row) { this.operation = 'update'; this.payload = [value]; return this; }
  delete() { this.operation = 'delete'; return this; }
  eq(column: string, value: unknown) { return this.filter(column, '=', value); }
  neq(column: string, value: unknown) { return this.filter(column, '<>', value); }
  gte(column: string, value: unknown) { return this.filter(column, '>=', value); }
  lte(column: string, value: unknown) { return this.filter(column, '<=', value); }
  in(column: string, value: unknown[]) { return this.filter(column, 'in', value); }
  is(column: string, value: null | boolean) { return this.filter(column, 'is', value); }
  not(column: string, op: string, value: null) {
    if (op !== 'is' || value !== null) throw new Error('Unsupported negation');
    return this.filter(column, 'is not', value);
  }
  private filter(column: string, op: string, value: unknown) {
    if (value === undefined) throw new Error('Undefined database filter');
    this.filters.push({ column, op, value }); return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.ordering.push({ column, ascending: options?.ascending !== false }); return this;
  }
  limit(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid limit');
    this.maximum = value; return this;
  }
  single() { this.cardinality = 'one'; return this as unknown as DatabaseQuery<Row>; }
  maybeSingle() { this.cardinality = 'optional'; return this as unknown as DatabaseQuery<Row | null>; }
  compile(): { sql: string; values: unknown[] } {
    const values: unknown[] = [];
    const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const fieldParam = (key: string, value: unknown) => param(value !== null && jsonColumns[this.table]?.includes(key) ? JSON.stringify(value) : value);
    const alias = 'record';
    const joins: string[] = [];
    const relationAliases = new Map<string, string>();
    const project = (table: string, source: string, selection: string): string => splitSelection(selection).map(field => {
      if (field === '*') return `${ident(source)}.*`;
      const match = /^(\w+)(!inner)?\(([\s\S]*)\)$/.exec(field);
      if (!match) return `${ident(source)}.${ident(field)}`;
      const [, related, inner, nested] = match;
      const key = relations[table]?.[related];
      if (!key) throw new Error('Unsupported relationship');
      const target = `${source}_${related}`;
      relationAliases.set(related, target);
      joins.push(`${inner ? 'INNER' : 'LEFT'} JOIN public.${ident(related)} AS ${ident(target)} ON ${ident(target)}.id = ${ident(source)}.${ident(key)}`);
      const fields = project(related, target, nested);
      return `(SELECT row_to_json(nested_row) FROM (SELECT ${fields}) nested_row WHERE ${ident(target)}.id IS NOT NULL) AS ${ident(related)}`;
    }).join(', ');
    const column = (name: string) => {
      const parts = name.split('.');
      if (parts.length === 1) return `${ident(alias)}.${ident(name)}`;
      const target = relationAliases.get(parts[0]);
      if (parts.length !== 2 || !target) throw new Error('Unsupported relationship filter');
      return `${ident(target)}.${ident(parts[1])}`;
    };
    const where = () => this.filters.length ? ' WHERE ' + this.filters.map(f => {
      const col = column(f.column);
      if (f.op === 'in') {
        const items = f.value as unknown[];
        return items.length ? `${col} IN (${items.map(param).join(', ')})` : 'FALSE';
      }
      if (f.op === 'is' || f.op === 'is not') {
        if (![null, true, false].includes(f.value as null)) throw new Error('Invalid IS operand');
        return `${col} ${f.op.toUpperCase()} ${f.value === null ? 'NULL' : f.value ? 'TRUE' : 'FALSE'}`;
      }
      return `${col} ${f.op} ${param(f.value)}`;
    }).join(' AND ') : '';
    const target = `public.${ident(this.table)} AS ${ident(alias)}`;
    let sql: string;
    if (this.operation === 'select') {
      const fields = project(this.table, alias, this.selection);
      sql = `SELECT ${fields} FROM ${target} ${joins.join(' ')}${where()}`;
      if (this.ordering.length) sql += ' ORDER BY ' + this.ordering.map(o => `${column(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ');
      if (this.maximum !== undefined) sql += ` LIMIT ${param(this.maximum)}`;
    } else {
      if (['update', 'delete'].includes(this.operation) && !this.filters.length) throw new Error('Unscoped database mutation refused');
      if (this.operation === 'delete') sql = `DELETE FROM ${target}${where()}`;
      else if (this.operation === 'update') {
        const entries = Object.entries(this.payload[0]).filter(([, v]) => v !== undefined);
        if (!entries.length) throw new Error('Empty database update');
        sql = `UPDATE ${target} SET ${entries.map(([k, v]) => `${ident(k)} = ${fieldParam(k, v)}`).join(', ')}${where()}`;
      } else {
        if (!this.payload.length) throw new Error('Empty database insert');
        const keys = [...new Set(this.payload.flatMap(row => Object.keys(row).filter(k => row[k] !== undefined)))];
        if (!keys.length) throw new Error('Empty database insert');
        sql = `INSERT INTO ${target} (${keys.map(ident).join(', ')}) VALUES ${this.payload.map(row => '(' + keys.map(k => row[k] === undefined ? 'DEFAULT' : fieldParam(k, row[k])).join(', ') + ')').join(', ')}`;
        if (this.operation === 'upsert') {
          const conflicts = this.conflict!.split(',').map(k => k.trim());
          const updates = keys.filter(k => !conflicts.includes(k));
          sql += ` ON CONFLICT (${conflicts.map(ident).join(', ')}) DO ` + (this.ignoreDuplicates || !updates.length ? 'NOTHING' : 'UPDATE SET ' + updates.map(k => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', '));
        }
      }
      if (this.returning) {
        if (this.selection.includes('(')) throw new Error('Relationships unsupported in mutation returns');
        sql += ' RETURNING ' + splitSelection(this.selection).map(k => k === '*' ? '*' : ident(k)).join(', ');
      }
    }
    return { sql, values };
  }
  private async run(): Promise<Result<T>> {
    try {
      // Supabase treats empty bulk inserts as a successful no-op.
      if (['insert', 'upsert'].includes(this.operation) && !this.payload.length) return { data: (this.returning ? [] : null) as T, error: null };
      const { sql, values } = this.compile();
      const result = await this.execute(sql, values);
      if (this.cardinality !== 'many') {
        if (result.rows.length > 1 || (this.cardinality === 'one' && result.rows.length === 0)) return { data: null, error: { code: 'PGRST116', message: 'Expected one row' } };
        return { data: (result.rows[0] || null) as T, error: null };
      }
      return { data: (this.operation === 'select' || this.returning ? result.rows : null) as T, error: null };
    } catch (err) {
      // Do not return database error details: they can include client data or secrets.
      return { data: null, error: { message: 'Database operation failed', code: (err as { code?: string }).code, constraint: (err as { constraint?: string }).constraint } };
    }
  }
  then<TResult1 = Result<T>, TResult2 = never>(onfulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    this.pending ??= this.run();
    return this.pending.then(onfulfilled, onrejected);
  }
}
