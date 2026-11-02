CREATE TABLE "portfolio_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"category" text DEFAULT 'Weddings' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"draft_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "album_id" uuid;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "is_cover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_album_id_portfolio_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."portfolio_albums"("id") ON DELETE no action ON UPDATE no action;