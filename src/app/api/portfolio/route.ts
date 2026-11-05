import { NextResponse } from 'next/server';
import { getPortfolio, getPortfolioAlbums } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [items, albums] = await Promise.all([getPortfolio(), getPortfolioAlbums()]);
  const photos = items.map((item) => ({
    id: item.id,
    type: 'photo',
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    mediaType: item.mediaType,
    ...(item.imagePublicId ? { imagePublicId: item.imagePublicId } : {}),
    featured: item.featured,
    featuredOrder: item.featuredOrder,
    sortOrder: item.sortOrder,
    created: item.createdAt.toISOString()
  }));
  const portfolio = [...photos, ...albums].sort((a, b) => a.sortOrder - b.sortOrder);
  return NextResponse.json(portfolio, {
    headers: { 'Cache-Control': 'no-store' }
  });
}