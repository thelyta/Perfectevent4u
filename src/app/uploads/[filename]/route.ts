import { NextResponse } from 'next/server';
import { imageContentType, readStoredImage } from '@/lib/image-storage';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const file = await readStoredImage(filename);
  if (!file) return new NextResponse(null, { status: 404 });

  const contentType = imageContentType(filename);
  const total = file.length;
  const range = request.headers.get('range');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
      if (Number.isFinite(start) && start <= end && start < total) {
        const chunk = file.subarray(start, end + 1);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=2592000, immutable',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    }
  }

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=2592000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
