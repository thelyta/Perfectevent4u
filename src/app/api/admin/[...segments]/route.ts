import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
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
import { ContentData, inquiries, portfolioAlbums, portfolioItems, services, siteContent } from '@/lib/db/schema';
import { imageContentType, readStoredImage, removeStoredImage, storeImage } from '@/lib/image-storage';
import { emailConfigured } from '@/lib/email';
import { getInstagramStatus, refreshInstagramToken, saveInstagramToken } from '@/lib/instagram';

const categories = ['Wedding Ceremony', 'Wedding Reception', 'Milestone Celebration', 'Corporate Event'];
const icons = ['planning', 'floral', 'management', 'venue', 'decor', 'catering', 'photo', 'music'];
const contentTypes = ['page', 'faq', 'blog', 'instagram', 'announcement', 'award', 'testimonial', 'settings'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ segments: string[] }> };

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function portfolioJson(item: typeof portfolioItems.$inferSelect) {
  const content = { ...item, ...(item.draftData || {}) };
  return {
    id: item.id,
    title: content.title,
    location: content.location,
    category: content.category,
    image: content.image,
    ...(content.imagePublicId ? { imagePublicId: content.imagePublicId } : {}),
    albumId: content.albumId || null,
    isCover: Boolean(content.isCover),
    featured: content.featured,
    featuredOrder: content.featuredOrder ?? null,
    sortOrder: content.sortOrder,
    isPublished: item.isPublished,
    hasDraft: Boolean(item.draftData),
    created: item.createdAt.toISOString()
  };
}

function serviceJson(item: typeof services.$inferSelect) {
  const content = { ...item, ...(item.draftData || {}) };
  return {
    id: item.id,
    title: content.title,
    description: content.description,
    icon: content.icon,
    sortOrder: content.sortOrder,
    isPublished: item.isPublished,
    hasDraft: Boolean(item.draftData),
    created: item.createdAt.toISOString()
  };
}

function portfolioValues(item: typeof portfolioItems.$inferSelect): ContentData {
  return {
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    imagePublicId: item.imagePublicId,
    albumId: item.albumId,
    isCover: item.isCover,
    featured: item.featured,
    featuredOrder: item.featuredOrder,
    sortOrder: item.sortOrder,
    ...(item.draftData || {})
  };
}

function albumValues(album: typeof portfolioAlbums.$inferSelect): ContentData {
  return {
    title: album.title,
    location: album.location,
    category: album.category,
    featured: album.featured,
    featuredOrder: album.featuredOrder,
    sortOrder: album.sortOrder,
    ...(album.draftData || {})
  };
}

function albumJson(album: typeof portfolioAlbums.$inferSelect, photos: (typeof portfolioItems.$inferSelect)[]) {
  const content = { ...album, ...(album.draftData || {}) };
  const draftCoverId = album.draftData?.coverPhotoId;
  return {
    id: album.id,
    title: content.title,
    location: content.location,
    category: content.category,
    featured: content.featured,
    featuredOrder: content.featuredOrder ?? null,
    sortOrder: content.sortOrder,
    coverPhotoId: (typeof draftCoverId === 'string' ? draftCoverId : null) || photos.find((photo) => photo.isCover)?.id || photos[0]?.id || null,
    isPublished: album.isPublished,
    hasDraft: Boolean(album.draftData),
    photos: photos.map(portfolioJson)
  };
}

function serviceValues(item: typeof services.$inferSelect): ContentData {
  return {
    title: item.title,
    description: item.description,
    icon: item.icon,
    sortOrder: item.sortOrder,
    ...(item.draftData || {})
  };
}

function draftSortOrder(item: { sortOrder: number; draftData: ContentData | null }) {
  const value = Number(item.draftData?.sortOrder);
  return Number.isInteger(value) ? value : item.sortOrder;
}

function draftFeaturedOrder(item: { featuredOrder: number | null; draftData: ContentData | null }) {
  const value = Number(item.draftData?.featuredOrder);
  if (Number.isInteger(value)) return value;
  return item.featuredOrder === null ? null : item.featuredOrder;
}

function nextSortOrder(lastPhoto: number | null, lastAlbum: number | null) {
  return Math.max(lastPhoto ?? -1, lastAlbum ?? -1) + 1;
}

function nextFeaturedOrder(lastPhoto: number | null, lastAlbum: number | null) {
  return Math.max(lastPhoto ?? -1, lastAlbum ?? -1) + 1;
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

  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  if (!db) return dbUnavailable();

  if (segments.length === 1 && segments[0] === 'content') {
    const records = await db.select().from(siteContent)
      .orderBy(asc(siteContent.contentType), asc(siteContent.sortOrder), asc(siteContent.slug));
    return NextResponse.json(records.map((record) => ({
      id: record.id,
      type: record.contentType,
      slug: record.slug,
      draftContent: record.draftContent,
      publishedContent: record.publishedContent,
      isPublished: record.publishedContent !== null,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt.toISOString()
    })), { headers: { 'Cache-Control': 'no-store' } });
  }

  if (segments.length === 1 && segments[0] === 'portfolio') {
    const records = await db.select().from(portfolioItems)
      .orderBy(sql`COALESCE((${portfolioItems.draftData}->>'sortOrder')::integer, ${portfolioItems.sortOrder})`, asc(portfolioItems.createdAt));
    return NextResponse.json(records.map(portfolioJson), { headers: { 'Cache-Control': 'no-store' } });
  }

  if (segments.length === 1 && segments[0] === 'services') {
    const records = await db.select().from(services)
      .orderBy(sql`COALESCE((${services.draftData}->>'sortOrder')::integer, ${services.sortOrder})`, asc(services.createdAt));
    return NextResponse.json(records.map(serviceJson), { headers: { 'Cache-Control': 'no-store' } });
  }

  if (segments.length === 1 && segments[0] === 'albums') {
    const albums = await db.select().from(portfolioAlbums)
      .orderBy(sql`COALESCE((${portfolioAlbums.draftData}->>'sortOrder')::integer, ${portfolioAlbums.sortOrder})`);
    const photos = albums.length
      ? await db.select().from(portfolioItems)
        .where(inArray(portfolioItems.albumId, albums.map((album) => album.id)))
        .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt))
      : [];
    return NextResponse.json(albums.map((album) => albumJson(album, photos.filter((photo) => photo.albumId === album.id))), {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  if (segments.length === 1 && segments[0] === 'integrations') {
    const instagram = await getInstagramStatus();
    return NextResponse.json({ instagram, emailConfigured: emailConfigured() }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  if (segments.length === 1 && segments[0] === 'inquiries') {
    const records = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
    return NextResponse.json(records.map((record) => ({
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      eventDate: record.eventDate,
      guests: record.guests,
      venue: record.venue,
      source: record.source,
      message: record.message,
      emailSent: record.emailSent,
      emailError: record.emailError,
      createdAt: record.createdAt.toISOString()
    })), { headers: { 'Cache-Control': 'no-store' } });
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

  if (route === 'upload') {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return failure('Bad request.');
    }
    const file = form.get('image');
    if (!(file instanceof File)) return failure('Choose an image to upload.');
    try {
      return NextResponse.json(await storeImage(file));
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Image upload failed.');
    }
  }

  if (route === 'content') {
    const body = await readJson(request);
    const type = clean(body?.type, 16);
    const slug = clean(body?.slug, 120).toLowerCase();
    const action = body?.action === 'publish' ? 'publish' : body?.action === 'unpublish' ? 'unpublish' : 'draft';
    const sortOrder = Number.isInteger(Number(body?.sortOrder)) ? Number(body?.sortOrder) : 0;
    const content = body?.content;
    if (!contentTypes.includes(type) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return failure('Choose a valid content type and URL slug.');
    }
    if (action !== 'unpublish' && (!content || typeof content !== 'object' || Array.isArray(content))) {
      return failure('Content must be an object.');
    }

    const [existing] = await db.select().from(siteContent)
      .where(and(eq(siteContent.contentType, type), eq(siteContent.slug, slug))).limit(1);
    if (action === 'unpublish') {
      if (!existing) return failure('Content not found.', 404);
      const [updated] = await db.update(siteContent).set({
        publishedContent: null,
        updatedAt: new Date()
      }).where(eq(siteContent.id, existing.id)).returning();
      return NextResponse.json({ id: updated.id, type, slug, draftContent: updated.draftContent, isPublished: false });
    }

    if (action === 'publish' && type === 'faq' && (content as Record<string, unknown>)._deleted !== true) {
      const faq = content as Record<string, unknown>;
      if (!clean(faq.question, 180) || !clean(faq.answer, 2000)) {
        return failure('Published FAQs need both a question and an answer.');
      }
    }
    if (action === 'publish' && type === 'blog') {
      const post = content as Record<string, unknown>;
      if (!clean(post.title, 140) || !clean(post.excerpt, 320) || !clean(post.body, 30000)) {
        return failure('Published blog posts need a title, excerpt, and article text.');
      }
    }
    if (action === 'publish' && type === 'instagram') {
      const post = content as Record<string, unknown>;
      if (!clean(post.image, 1000)) {
        return failure('Published journey posts need an image.');
      }
    }
    if (action === 'publish' && type === 'announcement') {
      const notice = content as Record<string, unknown>;
      const messages = Array.isArray(notice.barMessages)
        ? notice.barMessages.filter((message) => clean(message, 300))
        : [];
      if (asBool(notice.barEnabled) && !messages.length) {
        return failure('Add at least one announcement message, or turn the bar off.');
      }
      if (asBool(notice.popupEnabled) && !clean(notice.popupImage, 1000)) {
        return failure('Upload a popup banner, or turn the popup off.');
      }
    }
    if (action === 'publish' && type === 'award') {
      const award = content as Record<string, unknown>;
      if (!clean(award.name, 140)) {
        return failure('Published awards need a name.');
      }
      if (!clean(award.image, 1000)) {
        return failure('Published awards need an image.');
      }
    }
    if (action === 'publish' && type === 'testimonial') {
      const testimonial = content as Record<string, unknown>;
      if (!clean(testimonial.quote, 2000) || !clean(testimonial.author, 140)) {
        return failure('Published testimonials need a quote and an author.');
      }
    }

    const draftContent = { ...(content as ContentData), sortOrder };
    const values = action === 'publish'
      ? { draftContent, publishedContent: draftContent, sortOrder, updatedAt: new Date() }
      : { draftContent, updatedAt: new Date() };
    const [saved] = existing
      ? await db.update(siteContent).set(values).where(eq(siteContent.id, existing.id)).returning()
      : await db.insert(siteContent).values({ contentType: type, slug, sortOrder, ...values }).returning();
    return NextResponse.json({
      id: saved.id,
      type,
      slug,
      draftContent: saved.draftContent,
      publishedContent: saved.publishedContent,
      isPublished: saved.publishedContent !== null
    });
  }

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

      const submittedLocation = clean(form.get('location'), 60);
      const submittedCategory = clean(form.get('category'), 32);
      const featured = asBool(form.get('featured'));
      const publish = form.get('action') === 'publish';
      const albumTitle = clean(form.get('albumTitle'), 120);
      const requestedAlbumId = clean(form.get('albumId'), 64);
      const titles = form.getAll('titles').map((title) => clean(title, 80));

      const added = await db.transaction(async (transaction) => {
        const [lastPhoto] = await transaction.select({ sortOrder: portfolioItems.sortOrder, featuredOrder: portfolioItems.featuredOrder })
          .from(portfolioItems).orderBy(sql`${portfolioItems.sortOrder} DESC`).limit(1);
        const [lastAlbum] = await transaction.select({ sortOrder: portfolioAlbums.sortOrder, featuredOrder: portfolioAlbums.featuredOrder })
          .from(portfolioAlbums).orderBy(sql`${portfolioAlbums.sortOrder} DESC`).limit(1);
        const [lastFeaturedPhoto] = await transaction.select({ featuredOrder: portfolioItems.featuredOrder })
          .from(portfolioItems).where(isNotNull(portfolioItems.featuredOrder))
          .orderBy(sql`${portfolioItems.featuredOrder} DESC`).limit(1);
        const [lastFeaturedAlbum] = await transaction.select({ featuredOrder: portfolioAlbums.featuredOrder })
          .from(portfolioAlbums).where(isNotNull(portfolioAlbums.featuredOrder))
          .orderBy(sql`${portfolioAlbums.featuredOrder} DESC`).limit(1);

        let order = nextSortOrder(lastPhoto?.sortOrder ?? null, lastAlbum?.sortOrder ?? null);
        let featuredOrder = nextFeaturedOrder(lastFeaturedPhoto?.featuredOrder ?? null, lastFeaturedAlbum?.featuredOrder ?? null);

        let album: typeof portfolioAlbums.$inferSelect | null = null;
        if (requestedAlbumId && uuidPattern.test(requestedAlbumId)) {
          [album] = await transaction.select().from(portfolioAlbums)
            .where(eq(portfolioAlbums.id, requestedAlbumId)).limit(1);
          if (!album) throw new Error('Album not found.');
        } else if (albumTitle) {
          const albumCategory = categories.includes(submittedCategory) ? submittedCategory : categories[0];
          const albumOrder = order++;
          const albumFeaturedOrder = featured ? featuredOrder++ : null;
          [album] = await transaction.insert(portfolioAlbums).values({
            title: albumTitle,
            location: submittedLocation || null,
            category: albumCategory,
            featured,
            featuredOrder: albumFeaturedOrder,
            sortOrder: albumOrder,
            isPublished: publish,
            draftData: publish ? null : {
              title: albumTitle,
              location: submittedLocation || null,
              category: albumCategory,
              featured,
              featuredOrder: albumFeaturedOrder,
              sortOrder: albumOrder
            }
          }).returning();
        }

        const location = submittedLocation || album?.location || null;
        const category = categories.includes(submittedCategory) ? submittedCategory : (album?.category || categories[0]);
        let albumHasCover = false;
        if (album) {
          const [cover] = await transaction.select({ id: portfolioItems.id }).from(portfolioItems)
            .where(and(eq(portfolioItems.albumId, album.id), eq(portfolioItems.isCover, true))).limit(1);
          albumHasCover = Boolean(cover);
        }

        const values = stored.map((image, index) => {
          const featuredOrderValue = featured ? featuredOrder + index : null;
          return {
            title: titles[index] || 'Untitled event',
            location,
            category,
            image: image.image,
            imagePublicId: image.imagePublicId,
            albumId: album?.id || null,
            isCover: Boolean(album && !albumHasCover && index === 0),
            featured,
            featuredOrder: featuredOrderValue,
            sortOrder: order + index,
            isPublished: publish
          };
        });
        return transaction.insert(portfolioItems).values(values.map((item) => ({
          ...item,
          draftData: publish ? null : item
        }))).returning();
      });

      return NextResponse.json({
        ok: true,
        added: added.map(portfolioJson),
        albumId: added[0]?.albumId || null
      });
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
    const publish = body?.action === 'publish';

    try {
      const [last] = await db.select({ sortOrder: services.sortOrder }).from(services)
        .orderBy(sql`${services.sortOrder} DESC`).limit(1);
      const [item] = await db.insert(services).values({
        title,
        description,
        icon,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        isPublished: publish,
        draftData: publish ? null : { title, description, icon, sortOrder: (last?.sortOrder ?? -1) + 1 }
      }).returning();
      return NextResponse.json(serviceJson(item));
    } catch (error) {
      console.error('Service creation failed.', error);
      return failure('Something went wrong.', 500);
    }
  }

  if (segments.length === 3 && segments[0] === 'albums' && uuidPattern.test(segments[1])) {
    const [, albumId, action] = segments;
    const [album] = await db.select().from(portfolioAlbums).where(eq(portfolioAlbums.id, albumId)).limit(1);
    if (!album) return failure('Album not found.', 404);

    if (action === 'cover') {
      const body = await readJson(request);
      const photoId = clean(body?.photoId, 64);
      if (!uuidPattern.test(photoId)) return failure('Choose a valid photo.');
      const [photo] = await db.select().from(portfolioItems)
        .where(and(eq(portfolioItems.id, photoId), eq(portfolioItems.albumId, albumId))).limit(1);
      if (!photo) return failure('Photo is not part of this album.', 404);
      await db.update(portfolioAlbums).set({
        draftData: { ...album, ...(album.draftData || {}), coverPhotoId: photoId }
      }).where(eq(portfolioAlbums.id, albumId));
      return NextResponse.json({ ok: true, coverPhotoId: photoId, isPublished: album.isPublished });
    }

    if (action === 'publish' || action === 'unpublish') {
      const publish = action === 'publish';
      const draftCoverId = album.draftData?.coverPhotoId;
      await db.transaction(async (transaction) => {
        const albumData = { ...album, ...(album.draftData || {}) };
        await transaction.update(portfolioAlbums).set(publish ? {
          title: String(albumData.title || album.title),
          location: albumData.location === null ? null : clean(albumData.location, 60),
          category: categories.includes(String(albumData.category)) ? String(albumData.category) : categories[0],
          featured: asBool(albumData.featured),
          featuredOrder: albumData.featuredOrder === null || albumData.featuredOrder === undefined ? null : Number(albumData.featuredOrder),
          sortOrder: Number(albumData.sortOrder ?? album.sortOrder),
          isPublished: true,
          draftData: null
        } : { isPublished: false }).where(eq(portfolioAlbums.id, albumId));
        await transaction.update(portfolioItems).set(publish ? {
          isPublished: true,
          draftData: null
        } : { isPublished: false }).where(eq(portfolioItems.albumId, albumId));
        if (publish && typeof draftCoverId === 'string') {
          await transaction.update(portfolioItems).set({ isCover: false }).where(eq(portfolioItems.albumId, albumId));
          await transaction.update(portfolioItems).set({ isCover: true })
            .where(and(eq(portfolioItems.id, draftCoverId), eq(portfolioItems.albumId, albumId)));
        }
      });
      return NextResponse.json({ ok: true, isPublished: publish });
    }
  }

  if (route === 'portfolio/order') {
    const body = await readJson(request);
    const order = Array.isArray(body?.order) ? body.order : [];
    if (!order.length) return failure('Nothing to reorder.');
    await db.transaction(async (transaction) => {
      for (let index = 0; index < order.length; index += 1) {
        const entry = order[index] as Record<string, unknown>;
        const kind = clean(entry?.type, 10);
        const entryId = clean(entry?.id, 64);
        if (!uuidPattern.test(entryId)) continue;
        if (kind === 'album') {
          const [row] = await transaction.select().from(portfolioAlbums).where(eq(portfolioAlbums.id, entryId)).limit(1);
          if (!row) continue;
          await transaction.update(portfolioAlbums).set({
            sortOrder: index,
            ...(row.draftData ? { draftData: { ...albumValues(row), sortOrder: index } } : {})
          }).where(eq(portfolioAlbums.id, entryId));
        } else {
          const [row] = await transaction.select().from(portfolioItems).where(eq(portfolioItems.id, entryId)).limit(1);
          if (!row || row.albumId) continue;
          await transaction.update(portfolioItems).set({
            sortOrder: index,
            ...(row.draftData ? { draftData: { ...portfolioValues(row), sortOrder: index } } : {})
          }).where(eq(portfolioItems.id, entryId));
        }
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'portfolio/featured') {
    const body = await readJson(request);
    const order = Array.isArray(body?.order) ? body.order : [];
    await db.transaction(async (transaction) => {
      for (let index = 0; index < order.length; index += 1) {
        const entry = order[index] as Record<string, unknown>;
        const kind = clean(entry?.type, 10);
        const entryId = clean(entry?.id, 64);
        if (!uuidPattern.test(entryId)) continue;
        if (kind === 'album') {
          const [row] = await transaction.select().from(portfolioAlbums).where(eq(portfolioAlbums.id, entryId)).limit(1);
          if (!row) continue;
          await transaction.update(portfolioAlbums).set({
            featured: true,
            featuredOrder: index,
            ...(row.draftData ? { draftData: { ...albumValues(row), featured: true, featuredOrder: index } } : {})
          }).where(eq(portfolioAlbums.id, entryId));
        } else {
          const [row] = await transaction.select().from(portfolioItems).where(eq(portfolioItems.id, entryId)).limit(1);
          if (!row || row.albumId) continue;
          await transaction.update(portfolioItems).set({
            featured: true,
            featuredOrder: index,
            ...(row.draftData ? { draftData: { ...portfolioValues(row), featured: true, featuredOrder: index } } : {})
          }).where(eq(portfolioItems.id, entryId));
        }
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'integrations/instagram') {
    const body = await readJson(request);
    try {
      const result = await saveInstagramToken(clean(body?.accessToken, 2000));
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Could not save the token.');
    }
  }

  if (route === 'integrations/instagram/refresh') {
    try {
      const result = await refreshInstagramToken();
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Could not refresh the token.');
    }
  }

  const [resource, id, action] = segments;
  if (action === 'move' && id && uuidPattern.test(id) && segments.length === 3) {
    const body = await readJson(request);
    const direction = body?.dir;
    if (resource === 'portfolio') {
      await db.transaction(async (transaction) => {
        const rows = await transaction.select().from(portfolioItems)
          .orderBy(sql`COALESCE((${portfolioItems.draftData}->>'sortOrder')::integer, ${portfolioItems.sortOrder})`, asc(portfolioItems.createdAt));
        const index = rows.findIndex((item) => item.id === id);
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
        const current = rows[index];
        const next = rows[nextIndex];
        const currentOrder = draftSortOrder(current);
        const nextOrder = draftSortOrder(next);
        await transaction.update(portfolioItems).set({
          sortOrder: nextOrder,
          ...(current.draftData ? { draftData: { ...portfolioValues(current), sortOrder: nextOrder } } : {})
        }).where(eq(portfolioItems.id, current.id));
        await transaction.update(portfolioItems).set({
          sortOrder: currentOrder,
          ...(next.draftData ? { draftData: { ...portfolioValues(next), sortOrder: currentOrder } } : {})
        }).where(eq(portfolioItems.id, next.id));
      });
      return NextResponse.json({ ok: true });
    }
    if (resource === 'services') {
      await db.transaction(async (transaction) => {
        const rows = await transaction.select().from(services)
          .orderBy(sql`COALESCE((${services.draftData}->>'sortOrder')::integer, ${services.sortOrder})`, asc(services.createdAt));
        const index = rows.findIndex((item) => item.id === id);
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
        const current = rows[index];
        const next = rows[nextIndex];
        const currentOrder = draftSortOrder(current);
        const nextOrder = draftSortOrder(next);
        await transaction.update(services).set({
          draftData: { ...serviceValues(current), sortOrder: nextOrder }
        }).where(eq(services.id, current.id));
        await transaction.update(services).set({
          draftData: { ...serviceValues(next), sortOrder: currentOrder }
        }).where(eq(services.id, next.id));
      });
      return NextResponse.json({ ok: true });
    }
    if (resource === 'albums') {
      await db.transaction(async (transaction) => {
        const rows = await transaction.select().from(portfolioAlbums)
          .orderBy(sql`COALESCE((${portfolioAlbums.draftData}->>'sortOrder')::integer, ${portfolioAlbums.sortOrder})`, asc(portfolioAlbums.createdAt));
        const index = rows.findIndex((item) => item.id === id);
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
        const current = rows[index];
        const next = rows[nextIndex];
        const currentOrder = draftSortOrder(current);
        const nextOrder = draftSortOrder(next);
        await transaction.update(portfolioAlbums).set({
          sortOrder: nextOrder,
          ...(current.draftData ? { draftData: { ...albumValues(current), sortOrder: nextOrder } } : {})
        }).where(eq(portfolioAlbums.id, current.id));
        await transaction.update(portfolioAlbums).set({
          sortOrder: currentOrder,
          ...(next.draftData ? { draftData: { ...albumValues(next), sortOrder: currentOrder } } : {})
        }).where(eq(portfolioAlbums.id, next.id));
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

  if (resource === 'albums') {
    const [album] = await db.select().from(portfolioAlbums).where(eq(portfolioAlbums.id, id)).limit(1);
    if (!album) return failure('Album not found.', 404);
    const values: ContentData = {
      title: album.title,
      location: album.location,
      category: album.category,
      featured: album.featured,
      sortOrder: album.sortOrder,
      ...(album.draftData || {})
    };
    if (body.title !== undefined) values.title = clean(body.title, 120) || values.title;
    if (body.location !== undefined) values.location = clean(body.location, 60);
    if (body.category !== undefined) {
      const value = clean(body.category, 32);
      values.category = categories.includes(value) ? value : categories[0];
    }
    if (body.featured !== undefined) values.featured = asBool(body.featured);

    if (body.action === 'publish') {
      const [updated] = await db.update(portfolioAlbums).set({
        title: String(values.title || album.title),
        location: values.location === null ? null : clean(values.location, 60),
        category: String(values.category || categories[0]),
        featured: asBool(values.featured),
        featuredOrder: values.featuredOrder === null || values.featuredOrder === undefined ? null : Number(values.featuredOrder),
        sortOrder: Number(values.sortOrder ?? album.sortOrder),
        isPublished: true,
        draftData: null
      }).where(eq(portfolioAlbums.id, id)).returning();
      return NextResponse.json(albumJson(updated, await db.select().from(portfolioItems).where(eq(portfolioItems.albumId, id))));
    }

    const [updated] = await db.update(portfolioAlbums).set({ draftData: values })
      .where(eq(portfolioAlbums.id, id)).returning();
    return NextResponse.json(albumJson(updated, await db.select().from(portfolioItems).where(eq(portfolioItems.albumId, id))));
  }

  if (resource === 'portfolio') {
    const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id)).limit(1);
    if (!item) return failure('Photo not found.', 404);
    const values = portfolioValues(item);
    if (body.title !== undefined) values.title = clean(body.title, 80) || String(values.title || item.title);
    if (body.location !== undefined) values.location = clean(body.location, 60);
    if (body.category !== undefined) {
      const value = clean(body.category, 32);
      values.category = categories.includes(value) ? value : categories[0];
    }
    if (body.featured !== undefined) values.featured = asBool(body.featured);

    if (body.action === 'unpublish') {
      const [updated] = await db.update(portfolioItems).set({ isPublished: false, draftData: values })
        .where(eq(portfolioItems.id, id)).returning();
      return NextResponse.json(portfolioJson(updated));
    }
    if (body.action === 'publish') {
      const [updated] = await db.update(portfolioItems).set({
        title: String(values.title || item.title),
        location: values.location === null ? null : clean(values.location, 60),
        category: String(values.category || categories[0]),
        image: typeof values.image === 'string' ? values.image : item.image,
        imagePublicId: typeof values.imagePublicId === 'string' ? values.imagePublicId : null,
        featured: asBool(values.featured),
        featuredOrder: values.featuredOrder === null || values.featuredOrder === undefined ? null : Number(values.featuredOrder),
        sortOrder: Number(values.sortOrder ?? item.sortOrder),
        isPublished: true,
        draftData: null
      }).where(eq(portfolioItems.id, id)).returning();
      return NextResponse.json(portfolioJson(updated));
    }

    const [updated] = await db.update(portfolioItems).set({ draftData: values })
      .where(eq(portfolioItems.id, id)).returning();
    return NextResponse.json(portfolioJson(updated));
  }

  if (resource === 'services') {
    const [item] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    if (!item) return failure('Service not found.', 404);
    const values = serviceValues(item);
    const title = body.title === undefined ? String(values.title || '') : clean(body.title, 80);
    const description = body.description === undefined ? String(values.description || '') : clean(body.description, 500);
    if (!title || !description) return failure('Please add a title and a description.');
    const iconValue = body.icon === undefined ? String(values.icon || '') : clean(body.icon, 32);
    values.title = title;
    values.description = description;
    values.icon = icons.includes(iconValue) ? iconValue : icons[0];

    if (body.action === 'unpublish') {
      const [updated] = await db.update(services).set({ isPublished: false, draftData: values })
        .where(eq(services.id, id)).returning();
      return NextResponse.json(serviceJson(updated));
    }
    if (body.action === 'publish') {
      const [updated] = await db.update(services).set({
        title,
        description,
        icon: String(values.icon),
        sortOrder: Number(values.sortOrder ?? item.sortOrder),
        isPublished: true,
        draftData: null
      }).where(eq(services.id, id)).returning();
      return NextResponse.json(serviceJson(updated));
    }

    const [updated] = await db.update(services).set({ draftData: values })
      .where(eq(services.id, id)).returning();
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
  if (segments.length === 3 && segments[0] === 'content') {
    const [, type, slug] = segments;
    if (!['faq', 'blog', 'instagram', 'award', 'testimonial'].includes(type)) return failure('Not found.', 404);
    const [item] = await db.select().from(siteContent)
      .where(and(eq(siteContent.contentType, type), eq(siteContent.slug, slug))).limit(1);
    if (!item) return failure('Content not found.', 404);
    if (item.publishedContent) return failure('Unpublish this content before deleting it.', 409);
    await db.delete(siteContent).where(eq(siteContent.id, item.id));
    return NextResponse.json({ ok: true });
  }

  if (segments.length === 2 && segments[0] === 'inquiries' && uuidPattern.test(segments[1])) {
    const [item] = await db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.id, segments[1])).limit(1);
    if (!item) return failure('Inquiry not found.', 404);
    await db.delete(inquiries).where(eq(inquiries.id, segments[1]));
    return NextResponse.json({ ok: true });
  }

  if (segments.length === 2 && segments[0] === 'albums' && uuidPattern.test(segments[1])) {
    const albumId = segments[1];
    const [album] = await db.select().from(portfolioAlbums).where(eq(portfolioAlbums.id, albumId)).limit(1);
    if (!album) return failure('Album not found.', 404);
    const photos = await db.select().from(portfolioItems).where(eq(portfolioItems.albumId, albumId));
    await db.transaction(async (transaction) => {
      await transaction.delete(portfolioItems).where(eq(portfolioItems.albumId, albumId));
      await transaction.delete(portfolioAlbums).where(eq(portfolioAlbums.id, albumId));
    });
    await Promise.all(photos.map((photo) => removeStoredImage(photo.image, photo.imagePublicId)));
    return NextResponse.json({ ok: true });
  }

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