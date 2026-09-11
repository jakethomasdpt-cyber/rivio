import 'server-only';
import { Pool, types } from 'pg';
import { DatabaseQuery } from './database-query';

// Match the JSON representation used by the previous database API.
const appTypes = {
  getTypeParser(oid: number, format?: 'text' | 'binary') {
    if (oid === 1082) return (value: string) => value;
    if (oid === 1700) return (value: string) => Number(value);
    if (oid === 1184) return (value: string) => new Date(value).toISOString();
    return types.getTypeParser(oid, format as 'text');
  },
};

let pool: Pool | undefined;
export function getDatabasePool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 20_000 });
    pool.on('error', () => console.error('Database connection error'));
  }
  return pool;
}
export function createDatabaseClient() {
  return { from: (table: string) => new DatabaseQuery(table, async (sql, values) => getDatabasePool().query({ text: sql, values, types: appTypes })) };
}
