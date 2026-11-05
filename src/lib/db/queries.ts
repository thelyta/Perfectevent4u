import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from './index';
import { portfolioAlbums, portfolioItems, services, siteContent } from './schema';

function allowDbQueries() {
  return Boolean(process.env.DATABASE_URL) && process.env.NEXT_PHASE !== 'phase-production-build';
}

export async function getPortfolio() {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  return db.select().from(portfolioItems)
    .where(and(eq(portfolioItems.isPublished, true), isNull(portfolioItems.albumId)))
    .orderBy(portfolioItems.sortOrder);
}

export async function getPortfolioAlbums() {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  const albums = await db.select().from(portfolioAlbums)
    .where(eq(portfolioAlbums.isPublished, true))
    .orderBy(portfolioAlbums.sortOrder);
  if (!albums.length) return [];

  const photos = await db.select().from(portfolioItems)
    .where(and(inArray(portfolioItems.albumId, albums.map((album) => album.id)), eq(portfolioItems.isPublished, true)))
    .orderBy(asc(portfolioItems.sortOrder));
  return albums.flatMap((album) => {
    const albumPhotos = photos.filter((photo) => photo.albumId === album.id);
    if (!albumPhotos.length) return [];
    const cover = albumPhotos.find((photo) => photo.isCover) || albumPhotos[0];
    return [{
      id: album.id,
      type: 'album' as const,
      title: album.title,
      location: album.location,
      category: album.category,
      image: cover.image,
      mediaType: cover.mediaType,
      featured: album.featured,
      featuredOrder: album.featuredOrder,
      sortOrder: album.sortOrder,
      photos: albumPhotos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        image: photo.image,
        mediaType: photo.mediaType,
        location: photo.location,
        category: photo.category
      }))
    }];
  });
}

export async function getServices() {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  return db.select().from(services)
    .where(eq(services.isPublished, true))
    .orderBy(services.sortOrder);
}

export async function getPublishedContent(contentType: string, slug?: string) {
  if (!allowDbQueries()) return [];
  const db = getDb();
  if (!db) return [];

  const filters = [
    eq(siteContent.contentType, contentType),
    isNotNull(siteContent.publishedContent),
    sql`NOT COALESCE(${siteContent.publishedContent}->>'_deleted', 'false') = 'true'`
  ];
  if (slug) filters.push(eq(siteContent.slug, slug));

  return db.select().from(siteContent)
    .where(and(...filters))
    .orderBy(sql`COALESCE((${siteContent.publishedContent}->>'sortOrder')::integer, ${siteContent.sortOrder})`);
}

export async function getDatabaseHealth() {
  if (!allowDbQueries()) return false;
  const db = getDb();
  if (!db) return false;

  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
