CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_type" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"items_used" uuid[],
	"generated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "collection_items_collection_id_item_id_pk" PRIMARY KEY("collection_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"item_type" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"meta" jsonb,
	"topics" text[],
	"published_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now(),
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"summary" text,
	"transcript" jsonb
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"prompt_key" text NOT NULL,
	"schedule" text NOT NULL,
	"delivery" jsonb,
	"enabled" boolean DEFAULT true,
	"last_run" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"enabled" boolean DEFAULT true,
	"last_fetched" timestamp with time zone,
	"fetch_interval_minutes" integer DEFAULT 30
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_source_id_idx" ON "items" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "items_published_at_idx" ON "items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "items_item_type_idx" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "items_topics_idx" ON "items" USING gin ("topics");--> statement-breakpoint
CREATE INDEX "items_embedding_idx" ON "items" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "items_fts_idx" ON "items" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')));