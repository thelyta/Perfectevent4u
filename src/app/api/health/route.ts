import { NextResponse } from 'next/server';
import { getDatabaseHealth } from '@/lib/db/queries';

export async function GET() {
  const ok = await getDatabaseHealth();

  if (ok) {
    return NextResponse.json({ ok: true, storage: 'postgres' });
  }

  return NextResponse.json(
    { ok: false, error: 'database unavailable' },
    { status: 503 }
  );
}
