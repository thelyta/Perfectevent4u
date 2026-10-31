import { sql } from 'drizzle-orm';
import { getDb } from './index';
import { portfolioItems, services } from './schema';

function allowDbQueries() {
  return Boolean(process.env.DATABASE_URL) && process.env.NEXT_PHASE !== 'phase-production-build';
}

export async function getPortfolio() {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  return db.select().from(portfolioItems).orderBy(portfolioItems.sortOrder).limit(50);
}

export async function getServices() {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  return db.select().from(services).orderBy(services.sortOrder).limit(50);
}

export async function getDatabaseHealth() {
  if (!allowDbQueries()) return false;
  const db = getDb();
  if (!db) return false;

  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
