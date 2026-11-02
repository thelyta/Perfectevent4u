CREATE TABLE "site_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"slug" text NOT NULL,
	"draft_content" jsonb NOT NULL,
	"published_content" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "draft_data" jsonb;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "draft_data" jsonb;
--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_type_slug_unique" ON "site_content" USING btree ("content_type","slug");
--> statement-breakpoint
INSERT INTO "site_content" ("content_type", "slug", "draft_content", "published_content", "sort_order") VALUES
('page', 'home', '{"heroImage":"image/chika and rose/chika_and_rose copy.jpg","heroKicker":"London • Essex • UK","heroTitle":"Excellence in\nWedding Planning\n& Design","heroCtaText":"View Our Portfolio","heroCtaHref":"portfolio.html"}'::jsonb, '{"heroImage":"image/chika and rose/chika_and_rose copy.jpg","heroKicker":"London • Essex • UK","heroTitle":"Excellence in\nWedding Planning\n& Design","heroCtaText":"View Our Portfolio","heroCtaHref":"portfolio.html"}'::jsonb, 0),
('page', 'about', '{"heroImage":"wed2.webp","heroKicker":"Our Story","heroTitle":"About Us"}'::jsonb, '{"heroImage":"wed2.webp","heroKicker":"Our Story","heroTitle":"About Us"}'::jsonb, 1),
('page', 'portfolio', '{"heroImage":"wed.jpeg","heroKicker":"Our Work","heroTitle":"The Lookbook"}'::jsonb, '{"heroImage":"wed.jpeg","heroKicker":"Our Work","heroTitle":"The Lookbook"}'::jsonb, 2),
('page', 'services', '{"heroImage":"wed2.webp","heroKicker":"What We Do","heroTitle":"Our Services"}'::jsonb, '{"heroImage":"wed2.webp","heroKicker":"What We Do","heroTitle":"Our Services"}'::jsonb, 3),
('page', 'contact', '{"heroImage":"hall.jpg","heroKicker":"Get In Touch","heroTitle":"Begin Your Journey"}'::jsonb, '{"heroImage":"hall.jpg","heroKicker":"Get In Touch","heroTitle":"Begin Your Journey"}'::jsonb, 4);
--> statement-breakpoint
INSERT INTO "site_content" ("content_type", "slug", "draft_content", "published_content", "sort_order") VALUES
('faq', 'booking', '{"question":"How far in advance should we book?","answer":"We recommend booking 12-18 months in advance for full-service planning. For day-of coordination, 3-6 months is typically sufficient."}'::jsonb, '{"question":"How far in advance should we book?","answer":"We recommend booking 12-18 months in advance for full-service planning. For day-of coordination, 3-6 months is typically sufficient."}'::jsonb, 0),
('faq', 'travel', '{"question":"Do you travel outside of Essex?","answer":"Absolutely! We serve clients throughout London, Essex, and across the UK. Destination weddings can also be arranged."}'::jsonb, '{"question":"Do you travel outside of Essex?","answer":"Absolutely! We serve clients throughout London, Essex, and across the UK. Destination weddings can also be arranged."}'::jsonb, 1),
('faq', 'pricing', '{"question":"What is your pricing structure?","answer":"Our packages are tailored to each client’s needs. We offer full-service planning, partial planning, and day-of coordination. Contact us for a bespoke quote."}'::jsonb, '{"question":"What is your pricing structure?","answer":"Our packages are tailored to each client’s needs. We offer full-service planning, partial planning, and day-of coordination. Contact us for a bespoke quote."}'::jsonb, 2),
('faq', 'vendors', '{"question":"Can you work with our existing vendors?","answer":"Yes, we are happy to collaborate with vendors you have already selected. We also have a curated list of trusted partners we can recommend."}'::jsonb, '{"question":"Can you work with our existing vendors?","answer":"Yes, we are happy to collaborate with vendors you have already selected. We also have a curated list of trusted partners we can recommend."}'::jsonb, 3);