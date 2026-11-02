import { NextRequest, NextResponse } from 'next/server';
import { getPublishedContent } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const contentTypes = ['page', 'faq', 'blog', 'instagram', 'announcement', 'award', 'testimonial', 'settings'];

export async function GET(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  if (!contentTypes.includes(type)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const slug = request.nextUrl.searchParams.get('slug') || undefined;
  const records = await getPublishedContent(type, slug);
  const content = records.map((record) => ({
    slug: record.slug,
    ...(record.publishedContent || {})
  }));
  const wantsSingle = Boolean(slug) && (type === 'page' || type === 'announcement' || type === 'settings');
  return NextResponse.json(wantsSingle ? content[0] || null : content, {
    headers: { 'Cache-Control': 'no-store' }
  });
}