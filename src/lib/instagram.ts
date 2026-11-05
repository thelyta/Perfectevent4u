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

type IntegrationConfig = {
  accessToken: string;
  feedUrl: string;
  username: string;
  expiresAt: string | null;
};

type CacheMode = 'token' | 'feed';

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; posts: InstagramPost[]; mode: CacheMode } | null = null;

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

async function readIntegrationConfig(): Promise<IntegrationConfig> {
  const content = rowContent(await readIntegrationRow()) || {};
  return {
    accessToken: typeof content.accessToken === 'string' ? content.accessToken : '',
    feedUrl: typeof content.feedUrl === 'string' ? content.feedUrl : '',
    username: typeof content.username === 'string' ? content.username : '',
    expiresAt: typeof content.expiresAt === 'string' ? content.expiresAt : null
  };
}

async function writeIntegrationContent(content: Record<string, unknown>) {
  const db = getDb();
  if (!db) throw new Error('Database unavailable.');
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
}

export async function getInstagramFeedUrl() {
  if (process.env.INSTAGRAM_FEED_URL) return process.env.INSTAGRAM_FEED_URL.trim();
  const config = await readIntegrationConfig();
  return config.feedUrl.trim();
}

export async function getInstagramCredentials(): Promise<Credentials | null> {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    return { token: process.env.INSTAGRAM_ACCESS_TOKEN, source: 'env', username: '', expiresAt: null };
  }
  const config = await readIntegrationConfig();
  if (!config.accessToken) return null;
  return {
    token: config.accessToken,
    source: 'admin',
    username: config.username,
    expiresAt: config.expiresAt
  };
}

export async function getInstagramStatus() {
  const config = await readIntegrationConfig();
  const feedUrl = process.env.INSTAGRAM_FEED_URL || config.feedUrl;
  if (feedUrl) {
    return { connected: true, source: 'feed' as const, username: config.username, feedUrl, feedConfigured: true, tokenConfigured: Boolean(config.accessToken) };
  }
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    return { connected: true, source: 'env' as const, username: '', feedUrl: '', feedConfigured: false, tokenConfigured: true };
  }
  if (config.accessToken) {
    return { connected: true, source: 'admin' as const, username: config.username, feedUrl: '', feedConfigured: false, tokenConfigured: true, expiresAt: config.expiresAt };
  }
  return { connected: false, source: 'manual' as const, username: '', feedUrl: '', feedConfigured: false, tokenConfigured: false };
}

function relativeLabel(timestamp: unknown) {
  let then: number;
  if (typeof timestamp === 'number') {
    then = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  } else {
    const text = String(timestamp || '');
    if (/^\d+$/.test(text)) then = Number(text) < 1e12 ? Number(text) * 1000 : Number(text);
    else then = new Date(text).getTime();
  }
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

function bestImage(item: Record<string, unknown>) {
  const sizes = item.sizes && typeof item.sizes === 'object' ? item.sizes as Record<string, unknown> : null;
  if (sizes) {
    for (const key of ['medium', 'large', 'small', 'full']) {
      const size = sizes[key] && typeof sizes[key] === 'object' ? sizes[key] as Record<string, unknown> : null;
      if (size && typeof size.mediaUrl === 'string' && size.mediaUrl) return size.mediaUrl;
    }
  }
  const direct = [item.mediaUrl, item.media_url, item.thumbnailUrl, item.thumbnail_url, item.image, item.src];
  for (const value of direct) if (typeof value === 'string' && value) return value;
  return '';
}

function mapExternalPost(item: Record<string, unknown>): InstagramPost {
  return {
    id: String(item.id ?? item.pk ?? ''),
    image: bestImage(item),
    caption: String(item.caption ?? item.prunedCaption ?? item.message ?? ''),
    dateLabel: relativeLabel(item.timestamp ?? item.taken_at ?? item.created_at ?? item.date),
    link: String(item.permalink ?? item.link ?? item.url ?? ''),
    likes: Number(item.likeCount ?? item.like_count ?? item.likes ?? 0) || 0,
    comments: Number(item.commentsCount ?? item.comments_count ?? item.comments ?? 0) || 0,
    mediaType: String(item.mediaType ?? item.media_type ?? 'IMAGE')
  };
}

async function fetchExternalFeed(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`The Instagram feed URL returned ${response.status}.`);
  const data = await response.json().catch(() => null) as unknown;
  let posts: Record<string, unknown>[] = [];
  let username = '';
  if (Array.isArray(data)) {
    posts = data as Record<string, unknown>[];
  } else if (data && typeof data === 'object') {
    const object = data as Record<string, unknown>;
    if (Array.isArray(object.posts)) posts = object.posts as Record<string, unknown>[];
    else if (Array.isArray(object.data)) posts = object.data as Record<string, unknown>[];
    else if (Array.isArray(object.media)) posts = object.media as Record<string, unknown>[];
    if (typeof object.username === 'string') username = object.username;
  }
  return { posts, username };
}

function mapMedia(item: Record<string, unknown>): InstagramPost {
  const mediaType = String(item.media_type || item.mediaType || 'IMAGE');
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

async function fetchGraphMedia(token: string) {
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
  const feedUrl = await getInstagramFeedUrl();

  if (feedUrl) {
    if (cache && cache.mode === 'feed' && Date.now() - cache.at < CACHE_TTL_MS) {
      return { connected: true, source: 'feed' as const, posts: cache.posts, error: null as string | null };
    }
    try {
      const { posts } = await fetchExternalFeed(feedUrl);
      const mapped = posts.map(mapExternalPost).filter((post) => post.image);
      cache = { at: Date.now(), posts: mapped, mode: 'feed' };
      return { connected: true, source: 'feed' as const, posts: mapped, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Instagram feed request failed.';
      if (cache && cache.mode === 'feed') return { connected: true, source: 'feed' as const, posts: cache.posts, error: message };
      return { connected: false, source: 'feed' as const, posts: [] as InstagramPost[], error: message };
    }
  }

  const credentials = await getInstagramCredentials();
  if (!credentials) return { connected: false, source: 'manual' as const, posts: [] as InstagramPost[], error: null as string | null };

  if (cache && cache.mode === 'token' && Date.now() - cache.at < CACHE_TTL_MS) {
    return { connected: true, source: credentials.source, posts: cache.posts, error: null as string | null };
  }

  try {
    const posts = (await fetchGraphMedia(credentials.token)).map(mapMedia).filter((post) => post.image);
    cache = { at: Date.now(), posts, mode: 'token' };
    return { connected: true, source: credentials.source, posts, error: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram request failed.';
    if (cache && cache.mode === 'token') return { connected: true, source: credentials.source, posts: cache.posts, error: message };
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
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Paste an Instagram access token first.');
  const info = await verifyToken(trimmed);
  const previous = rowContent(await readIntegrationRow()) || {};
  const content = { ...previous, accessToken: trimmed, username: info.username || '', savedAt: new Date().toISOString() };
  await writeIntegrationContent(content);
  return { username: content.username };
}

export async function saveInstagramFeedUrl(url: string) {
  const trimmed = url.trim();
  const previous = rowContent(await readIntegrationRow()) || {};

  if (!trimmed) {
    const content = { ...previous };
    delete content.feedUrl;
    if (!content.accessToken) {
      const db = getDb();
      if (db) {
        const [existing] = await db.select().from(siteContent)
          .where(and(eq(siteContent.contentType, 'integration'), eq(siteContent.slug, 'instagram')))
          .limit(1);
        if (existing) await db.delete(siteContent).where(eq(siteContent.id, existing.id));
      }
      cache = null;
      return { cleared: true, username: '' };
    }
    await writeIntegrationContent(content);
    return { cleared: true, username: String(content.username || '') };
  }

  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { throw new Error('Enter a valid feed URL.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('The feed URL must start with http or https.');

  const feed = await fetchExternalFeed(trimmed);
  if (!feed.posts.length) throw new Error('That feed URL did not return any posts.');

  const content = { ...previous, feedUrl: trimmed, username: feed.username || previous.username || '', feedSavedAt: new Date().toISOString() };
  await writeIntegrationContent(content);
  return { username: String(content.username || ''), posts: feed.posts.length };
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
  const previous = rowContent(await readIntegrationRow()) || {};
  const content = { ...previous, accessToken: data.access_token, expiresAt, savedAt: new Date().toISOString() };
  await writeIntegrationContent(content);
  return { expiresAt };
}

export function clearInstagramCache() {
  cache = null;
}
