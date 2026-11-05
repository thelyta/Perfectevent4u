import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export type ContentData = Record<string, unknown>;

export const portfolioAlbums = pgTable('portfolio_albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  location: text('location'),
  category: text('category').notNull().default('Wedding Ceremony'),
  featured: boolean('featured').notNull().default(false),
  featuredOrder: integer('featured_order'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  draftData: jsonb('draft_data').$type<ContentData>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const portfolioItems = pgTable('portfolio_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  location: text('location'),
  category: text('category').notNull().default('Wedding Ceremony'),
  image: text('image'),
  imagePublicId: text('image_public_id'),
  mediaType: text('media_type').notNull().default('image'),
  albumId: uuid('album_id').references(() => portfolioAlbums.id),
  isCover: boolean('is_cover').notNull().default(false),
  featured: boolean('featured').notNull().default(false),
  featuredOrder: integer('featured_order'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  draftData: jsonb('draft_data').$type<ContentData>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('planning'),
  image: text('image'),
  imagePublicId: text('image_public_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  draftData: jsonb('draft_data').$type<ContentData>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const siteContent = pgTable('site_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentType: text('content_type').notNull(),
  slug: text('slug').notNull(),
  draftContent: jsonb('draft_content').$type<ContentData>().notNull(),
  publishedContent: jsonb('published_content').$type<ContentData>(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  typeSlugUnique: uniqueIndex('site_content_type_slug_unique').on(table.contentType, table.slug)
}));

export const inquiries = pgTable('inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  eventDate: text('event_date'),
  guests: text('guests'),
  venue: text('venue'),
  source: text('source'),
  message: text('message'),
  emailSent: boolean('email_sent').notNull().default(false),
  emailError: text('email_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
