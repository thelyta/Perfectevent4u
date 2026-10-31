import { NextResponse } from 'next/server';
import { imageContentType, readStoredImage } from '@/lib/image-storage';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const image = await readStoredImage(filename);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': imageContentType(filename),
      'Cache-Control': 'public, max-age=2592000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}