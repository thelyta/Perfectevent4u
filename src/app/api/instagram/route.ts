import { NextResponse } from 'next/server';
import { getPublishedContent } from '@/lib/db/queries';
import { getInstagramFeed } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET() {
  const feed = await getInstagramFeed();

  if (feed.connected && feed.posts.length) {
    return NextResponse.json({
      source: feed.source,
      posts: feed.posts
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const records = await getPublishedContent('instagram');
  const posts = records.map((record) => ({ slug: record.slug, ...(record.publishedContent || {}) }));

  return NextResponse.json({
    source: 'manual',
    connected: false,
    error: feed.error || null,
    posts
  }, { headers: { 'Cache-Control': 'no-store' } });
}
