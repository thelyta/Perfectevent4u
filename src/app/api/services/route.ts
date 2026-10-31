import { NextResponse } from 'next/server';
import { getServices } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await getServices();
  return NextResponse.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    created: item.createdAt.toISOString()
  })), {
    headers: { 'Cache-Control': 'no-store' }
  });
}