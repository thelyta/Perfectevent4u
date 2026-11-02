CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"event_date" text,
	"guests" text,
	"venue" text,
	"source" text,
	"message" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_albums" ALTER COLUMN "category" SET DEFAULT 'Wedding Ceremony';--> statement-breakpoint
ALTER TABLE "portfolio_items" ALTER COLUMN "category" SET DEFAULT 'Wedding Ceremony';--> statement-breakpoint
ALTER TABLE "portfolio_albums" ADD COLUMN "featured_order" integer;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "featured_order" integer;--> statement-breakpoint
UPDATE "portfolio_items" SET "category" = CASE
	WHEN "category" = 'Weddings' THEN 'Wedding Ceremony'
	WHEN "category" = 'Receptions' THEN 'Wedding Reception'
	WHEN "category" = 'Corporate' THEN 'Corporate Event'
	WHEN "category" = 'Celebrations' THEN 'Milestone Celebration'
	ELSE "category" END;--> statement-breakpoint
UPDATE "portfolio_albums" SET "category" = CASE
	WHEN "category" = 'Weddings' THEN 'Wedding Ceremony'
	WHEN "category" = 'Receptions' THEN 'Wedding Reception'
	WHEN "category" = 'Corporate' THEN 'Corporate Event'
	WHEN "category" = 'Celebrations' THEN 'Milestone Celebration'
	ELSE "category" END;--> statement-breakpoint
UPDATE "portfolio_items" SET "featured_order" = "sort_order" WHERE "featured" = true;--> statement-breakpoint
UPDATE "portfolio_albums" SET "featured_order" = "sort_order" WHERE "featured" = true;