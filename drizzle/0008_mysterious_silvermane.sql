ALTER TABLE "portfolio_items" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
INSERT INTO "site_content" ("content_type", "slug", "draft_content", "published_content", "sort_order") VALUES
('page', 'faqs', '{"heroImage":"wed2.webp","heroKicker":"Questions","heroTitle":"Frequently Asked Questions"}'::jsonb, '{"heroImage":"wed2.webp","heroKicker":"Questions","heroTitle":"Frequently Asked Questions"}'::jsonb, 6)
ON CONFLICT ("content_type", "slug") DO NOTHING;