INSERT INTO "site_content" ("content_type", "slug", "draft_content", "published_content", "sort_order") VALUES
('page', 'blog', '{"heroImage":"wed2.webp","heroKicker":"Stories & Inspiration","heroTitle":"The Journal"}'::jsonb, '{"heroImage":"wed2.webp","heroKicker":"Stories & Inspiration","heroTitle":"The Journal"}'::jsonb, 5)
ON CONFLICT ("content_type", "slug") DO NOTHING;