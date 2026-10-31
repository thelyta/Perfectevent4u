import { asc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import {
  adminConfigured,
  adminCookie,
  adminSessionMaxAge,
  clearLoginFailures,
  createAdminSession,
  isAdminAuthenticated,
  loginAllowed,
  recordLoginFailure,
  requireAdmin,
  verifyAdminPassword
} from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { portfolioItems, services } from '@/lib/db/schema';
import { imageContentType, readStoredImage, removeStoredImage, storeImage } from '@/lib/image-storage';

const categories = ['Weddings', 'Receptions', 'Corporate', 'Celebrations'];
const icons = ['planning', 'floral', 'management', 'venue', 'decor', 'catering', 'photo', 'music'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ segments: string[] }> };

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function portfolioJson(item: typeof portfolioItems.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    ...(item.imagePublicId ? { imagePublicId: item.imagePublicId } : {}),
    featured: item.featured,
    created: item.createdAt.toISOString()
  };
}

function serviceJson(item: typeof services.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    created: item.createdAt.toISOString()
  };
}

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readJson(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function requestIp(request: NextRequest) {
  return request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function dbUnavailable() {
  return failure('Database unavailable.', 503);
}

export async function GET(request: NextRequest, context: Context) {
  const { segments } = await context.params;
  if (segments.length === 1 && segments[0] === 'session') {
    return NextResponse.json({
      authenticated: isAdminAuthenticated(request),
      configured: adminConfigured()
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return failure('Not found.', 404);
}

export async function POST(request: NextRequest, context: Context) {
  const { segments } = await context.params;
  const route = segments.join('/');

  if (route === 'login') {
    if (!adminConfigured()) {
      return failure('Admin password is not set on the server yet. Set ADMIN_PASSWORD and restart.', 503);
    }
    const ip = requestIp(request);
    if (!loginAllowed(ip)) return failure('Too many attempts. Please try again in 15 minutes.', 429);
    const body = await readJson(request);
    const password = clean(body?.password, 1024);
    if (!verifyAdminPassword(password)) {
      recordLoginFailure(ip);
      return failure('Incorrect password.', 401);
    }
    clearLoginFailures(ip);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminCookie, createAdminSession(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: adminSessionMaxAge
    });
    return response;
  }

  if (route === 'logout') {
    const denied = requireAdmin(request);
    if (denied) return denied;
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminCookie, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0
    });
    return response;
  }

  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  if (!db) return dbUnavailable();

  if (route === 'portfolio') {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return failure('Bad request.');
    }
    const files = form.getAll('images').filter((entry): entry is File => entry instanceof File);
    if (!files.length) return failure('Please choose at least one photo.');
    if (files.length > 20) return failure('You can upload up to 20 photos at a time.');

    const stored: Awaited<ReturnType<typeof storeImage>>[] = [];
    try {
      for (const file of files) stored.push(await storeImage(file));

      const location = clean(form.get('location'), 60);
      const submittedCategory = clean(form.get('category'), 32);
      const category = categories.includes(submittedCategory) ? submittedCategory : categories[0];
      const featured = asBool(form.get('featured'));
      const titles = form.getAll('titles').map((title) => clean(title, 80));

      const added = await db.transaction(async (transaction) => {
        await transaction.update(portfolioItems).set({
          sortOrder: sql`${portfolioItems.sortOrder} + ${stored.length}`
        });
        return transaction.insert(portfolioItems).values(stored.map((image, index) => ({
          title: titles[index] || 'Untitled event',
          location,
          category,
          image: image.image,
          imagePublicId: image.imagePublicId,
          featured,
          sortOrder: index
        }))).returning();
      });

      return NextResponse.json({ ok: true, added: added.map(portfolioJson) });
    } catch (error) {
      await Promise.all(stored.map((image) => removeStoredImage(image.image, image.imagePublicId)));
      console.error('Portfolio upload failed.', error);
      return failure(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  if (route === 'services') {
    const body = await readJson(request);
    const title = clean(body?.title, 80);
    const description = clean(body?.description, 500);
    if (!title || !description) return failure('Please add a title and a description.');
    const iconValue = clean(body?.icon, 32);
    const icon = icons.includes(iconValue) ? iconValue : icons[0];

    try {
      const [last] = await db.select({ sortOrder: services.sortOrder }).from(services)
        .orderBy(sql`${services.sortOrder} DESC`).limit(1);
      const [item] = await db.insert(services).values({
        title,
        description,
        icon,
        sortOrder: (last?.sortOrder ?? -1) + 1
      }).returning();
      return NextResponse.json(serviceJson(item));
    } catch (error) {
      console.error('Service creation failed.', error);
      return failure('Something went wrong.', 500);
    }
  }

  const [resource, id, action] = segments;
  if (action === 'move' && id && uuidPattern.test(id) && segments.length === 3) {
    const body = await readJson(request);
    const direction = body?.dir;
    if (resource === 'portfolio') {
      await db.transaction(async (transaction) => {
        const rows = await transaction.select().from(portfolioItems)
          .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt));
        const index = rows.findIndex((item) => item.id === id);
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
        const current = rows[index];
        const next = rows[nextIndex];
        await transaction.update(portfolioItems).set({ sortOrder: next.sortOrder }).where(eq(portfolioItems.id, current.id));
        await transaction.update(portfolioItems).set({ sortOrder: current.sortOrder }).where(eq(portfolioItems.id, next.id));
      });
      return NextResponse.json({ ok: true });
    }
    if (resource === 'services') {
      await db.transaction(async (transaction) => {
        const rows = await transaction.select().from(services)
          .orderBy(asc(services.sortOrder), asc(services.createdAt));
        const index = rows.findIndex((item) => item.id === id);
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
        const current = rows[index];
        const next = rows[nextIndex];
        await transaction.update(services).set({ sortOrder: next.sortOrder }).where(eq(services.id, current.id));
        await transaction.update(services).set({ sortOrder: current.sortOrder }).where(eq(services.id, next.id));
      });
      return NextResponse.json({ ok: true });
    }
  }

  return failure('Not found.', 404);
}

export async function PUT(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  if (!db) return dbUnavailable();

  const { segments } = await context.params;
  const [resource, id] = segments;
  if (segments.length !== 2 || !id || !uuidPattern.test(id)) return failure('Not found.', 404);
  const body = await readJson(request);
  if (!body) return failure('Bad request.');

  if (resource === 'portfolio') {
    const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id)).limit(1);
    if (!item) return failure('Photo not found.', 404);
    const patch: Partial<typeof portfolioItems.$inferInsert> = {};
    if (body.title !== undefined) patch.title = clean(body.title, 80) || item.title;
    if (body.location !== undefined) patch.location = clean(body.location, 60);
    if (body.category !== undefined) {
      const value = clean(body.category, 32);
      patch.category = categories.includes(value) ? value : categories[0];
    }
    if (body.featured !== undefined) patch.featured = asBool(body.featured);
    const [updated] = await db.update(portfolioItems).set(patch).where(eq(portfolioItems.id, id)).returning();
    return NextResponse.json(portfolioJson(updated));
  }

  if (resource === 'services') {
    const title = clean(body.title, 80);
    const description = clean(body.description, 500);
    if (!title || !description) return failure('Please add a title and a description.');
    const [item] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    if (!item) return failure('Service not found.', 404);
    const iconValue = clean(body.icon, 32);
    const [updated] = await db.update(services).set({
      title,
      description,
      icon: icons.includes(iconValue) ? iconValue : icons[0]
    }).where(eq(services.id, id)).returning();
    return NextResponse.json(serviceJson(updated));
  }

  return failure('Not found.', 404);
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  if (!db) return dbUnavailable();

  const { segments } = await context.params;
  const [resource, id] = segments;
  if (segments.length !== 2 || !id || !uuidPattern.test(id)) return failure('Not found.', 404);

  if (resource === 'portfolio') {
    const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id)).limit(1);
    if (!item) return failure('Photo not found.', 404);
    await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
    await removeStoredImage(item.image, item.imagePublicId);
    return NextResponse.json({ ok: true });
  }

  if (resource === 'services') {
    const [item] = await db.select({ id: services.id }).from(services).where(eq(services.id, id)).limit(1);
    if (!item) return failure('Service not found.', 404);
    await db.delete(services).where(eq(services.id, id));
    return NextResponse.json({ ok: true });
  }

  return failure('Not found.', 404);
}

export const runtime = 'nodejs';