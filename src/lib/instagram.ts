import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { siteContent } from './db/schema';

export type InstagramPost = {
  id: string;
  image: string;
  caption: string;
  dateLabel: string;
  link: string;
  likes: number;
  comments: number;
  mediaType: string;
};

type Credentials = {
  token: string;
  source: 'env' | 'admin';
  username: string;
  expiresAt: string | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; posts: InstagramPost[] } | null = null;

async function readIntegrationRow() {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(siteContent)
    .where(and(eq(siteContent.contentType, 'integration'), eq(siteContent.slug, 'instagram')))
    .limit(1);
  return row || null;
}

function rowContent(row: Awaited<ReturnType<typeof readIntegrationRow>>) {
  if (!row) return null;
  const content = row.publishedContent || row.draftContent;
  return content && typeof content === 'object' ? content as Record<string, unknown> : null;
}

export async function getInstagramCredentials(): Promise<Credentials | null> {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    return { token: process.env.INSTAGRAM_ACCESS_TOKEN, source: 'env', username: '', expiresAt: null };
  }
  const content = rowContent(await readIntegrationRow());
  const token = content && typeof content.accessToken === 'string' ? content.accessToken : '';
  if (!token) return null;
  return {
    token,
    source: 'admin',
    username: typeof content?.username === 'string' ? content.username : '',
    expiresAt: typeof content?.expiresAt === 'string' ? content.expiresAt : null
  };
}

export async function getInstagramStatus() {
  const credentials = await getInstagramCredentials();
  if (!credentials) return { connected: false, source: 'manual' as const, username: '' };
  return { connected: true, source: credentials.source, username: credentials.username, expiresAt: credentials.expiresAt };
}

function relativeLabel(timestamp: unknown) {
  const then = new Date(String(timestamp || '')).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  return new Date(then).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapMedia(item: Record<string, unknown>): InstagramPost {
  const mediaType = String(item.media_type || 'IMAGE');
  const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS';
  const image = String((isVideo ? item.thumbnail_url : item.media_url) || item.media_url || item.thumbnail_url || '');
  return {
    id: String(item.id || ''),
    image,
    caption: String(item.caption || ''),
    dateLabel: relativeLabel(item.timestamp),
    link: String(item.permalink || ''),
    likes: 0,
    comments: 0,
    mediaType
  };
}

async function fetchMedia(token: string) {
  const url = new URL('https://graph.instagram.com/me/media');
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
  url.searchParams.set('limit', '12');
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => ({})) as { data?: Record<string, unknown>[]; error?: { message?: string } };
  if (!response.ok) throw new Error(data?.error?.message || 'Instagram request failed.');
  return Array.isArray(data.data) ? data.data : [];
}

export async function getInstagramFeed() {
  const credentials = await getInstagramCredentials();
  if (!credentials) return { connected: false, source: 'manual' as const, posts: [] as InstagramPost[], error: null as string | null };

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { connected: true, source: credentials.source, posts: cache.posts, error: null as string | null };
  }

  try {
    const posts = (await fetchMedia(credentials.token)).map(mapMedia).filter((post) => post.image);
    cache = { at: Date.now(), posts };
    return { connected: true, source: credentials.source, posts, error: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram request failed.';
    if (cache) return { connected: true, source: credentials.source, posts: cache.posts, error: message };
    return { connected: false, source: credentials.source, posts: [] as InstagramPost[], error: message };
  }
}

async function verifyToken(token: string) {
  const url = new URL('https://graph.instagram.com/me');
  url.searchParams.set('fields', 'id,username');
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => ({})) as { id?: string; username?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(data?.error?.message || 'That access token could not be verified.');
  return data;
}

export async function saveInstagramToken(token: string) {
  const db = getDb();
  if (!db) throw new Error('Database unavailable.');
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Paste an Instagram access token first.');
  const info = await verifyToken(trimmed);
  const content = { accessToken: trimmed, username: info.username || '', savedAt: new Date().toISOString() };
  const [existing] = await db.select().from(siteContent)
    .where(and(eq(siteContent.contentType, 'integration'), eq(siteContent.slug, 'instagram')))
    .limit(1);
  if (existing) {
    await db.update(siteContent)
      .set({ draftContent: content, publishedContent: content, updatedAt: new Date() })
      .where(eq(siteContent.id, existing.id));
  } else {
    await db.insert(siteContent).values({
      contentType: 'integration', slug: 'instagram', draftContent: content, publishedContent: content
    });
  }
  cache = null;
  return { username: content.username };
}

export async function refreshInstagramToken() {
  const credentials = await getInstagramCredentials();
  if (!credentials) throw new Error('No Instagram token is saved yet.');
  if (credentials.source === 'env') {
    throw new Error('The token comes from the server environment. Update INSTAGRAM_ACCESS_TOKEN instead.');
  }
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', credentials.token);
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!response.ok || !data.access_token) throw new Error(data?.error?.message || 'The token could not be refreshed.');
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;
  const db = getDb();
  if (!db) throw new Error('Database unavailable.');
  const [existing] = await db.select().from(siteContent)
    .where(and(eq(siteContent.contentType, 'integration'), eq(siteContent.slug, 'instagram')))
    .limit(1);
  const previous = rowContent(existing) || {};
  const content = { ...previous, accessToken: data.access_token, expiresAt, savedAt: new Date().toISOString() };
  if (existing) {
    await db.update(siteContent)
      .set({ draftContent: content, publishedContent: content, updatedAt: new Date() })
      .where(eq(siteContent.id, existing.id));
  }
  cache = null;
  return { expiresAt };
}

export function clearInstagramCache() {
  cache = null;
}
