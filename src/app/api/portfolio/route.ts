import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await getPortfolio();
  return NextResponse.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    ...(item.imagePublicId ? { imagePublicId: item.imagePublicId } : {}),
    featured: item.featured,
    created: item.createdAt.toISOString()
  })), {
    headers: { 'Cache-Control': 'no-store' }
  });
}