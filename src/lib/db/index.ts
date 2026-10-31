import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var __pe4uDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  return drizzle(pool, { schema });
}

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!globalThis.__pe4uDb) globalThis.__pe4uDb = createDb();
  return globalThis.__pe4uDb;
}
