import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { inquiries, siteContent } from '@/lib/db/schema';
import { sendInquiryEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const windowMs = 15 * 60 * 1000;
const maxSubmissions = 5;
const attempts = new Map<string, { count: number; first: number }>();

function clientIp(request: NextRequest) {
  return request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function allowed(ip: string) {
  const record = attempts.get(ip);
  if (!record || Date.now() - record.first > windowMs) {
    attempts.set(ip, { count: 1, first: Date.now() });
    return true;
  }
  record.count += 1;
  return record.count <= maxSubmissions;
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

async function inquiryRecipient() {
  const db = getDb();
  if (db) {
    const [row] = await db.select().from(siteContent)
      .where(and(eq(siteContent.contentType, 'settings'), eq(siteContent.slug, 'site')))
      .limit(1);
    const content = row ? (row.publishedContent || row.draftContent) : null;
    const configured = content && typeof content === 'object' ? (content as Record<string, unknown>).inquiryEmail : '';
    if (typeof configured === 'string' && emailPattern.test(configured)) return configured;
  }
  if (process.env.INQUIRY_EMAIL) return process.env.INQUIRY_EMAIL;
  return process.env.SMTP_USER || '';
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!allowed(ip)) {
    return NextResponse.json({ error: 'Too many enquiries sent. Please try again later.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  if (!name || !emailPattern.test(email)) {
    return NextResponse.json({ error: 'Please enter your name and a valid email address.' }, { status: 400 });
  }

  const inquiry = {
    name,
    email,
    phone: clean(body.phone, 60) || null,
    eventDate: clean(body.eventDate, 60) || null,
    guests: clean(body.guests, 40) || null,
    venue: clean(body.venue, 160) || null,
    source: clean(body.source, 80) || null,
    message: clean(body.message, 4000) || null
  };

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'The enquiry service is temporarily unavailable. Please email us directly.' }, { status: 503 });
  }

  const [saved] = await db.insert(inquiries).values(inquiry).returning();

  const recipient = await inquiryRecipient();
  const result = await sendInquiryEmail(recipient, inquiry);

  await db.update(inquiries)
    .set({ emailSent: result.sent, emailError: result.sent ? null : (result.error || 'Not sent.') })
    .where(eq(inquiries.id, saved.id));

  if (!result.sent) {
    console.warn('Inquiry stored but not emailed:', result.error);
  }

  return NextResponse.json({ ok: true, emailed: result.sent });
}
