import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom pgvector type
// ---------------------------------------------------------------------------

const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1024})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    return String(value).replace(/[[\]]/g, "").split(",").map(Number);
  },
});

// ---------------------------------------------------------------------------
// items
// ---------------------------------------------------------------------------

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    itemType: text("item_type").notNull(),
    url: text("url"),
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content"),
    meta: jsonb("meta"),
    topics: text("topics").array(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow(),
    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (table) => [
    // Unique constraint on (source, source_id)
    uniqueIndex("items_source_source_id_idx").on(table.source, table.sourceId),

    // published_at DESC for timeline queries
    index("items_published_at_idx").on(table.publishedAt),

    // item_type for filtering
    index("items_item_type_idx").on(table.itemType),

    // GIN index on topics array
    index("items_topics_idx").using("gin", table.topics),

    // IVFFlat index on embedding for vector cosine similarity
    index("items_embedding_idx").using(
      "ivfflat",
      sql`${table.embedding} vector_cosine_ops`,
    ),

    // GIN full-text search index on title + content
    index("items_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.title}, '') || ' ' || coalesce(${table.content}, ''))`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// sources
// ---------------------------------------------------------------------------

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config"),
  enabled: boolean("enabled").default(true),
  lastFetched: timestamp("last_fetched", { withTimezone: true }),
  fetchIntervalMinutes: integer("fetch_interval_minutes").default(30),
});

// ---------------------------------------------------------------------------
// annotations
// ---------------------------------------------------------------------------

export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// collections
// ---------------------------------------------------------------------------

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// collection_items  (many-to-many join table)
// ---------------------------------------------------------------------------

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.itemId] })],
);

// ---------------------------------------------------------------------------
// briefs
// ---------------------------------------------------------------------------

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefType: text("brief_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  itemsUsed: uuid("items_used").array(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// scheduled_jobs
// ---------------------------------------------------------------------------

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  promptKey: text("prompt_key").notNull(),
  schedule: text("schedule").notNull(),
  delivery: jsonb("delivery"),
  enabled: boolean("enabled").default(true),
  lastRun: timestamp("last_run", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// research_sessions
// ---------------------------------------------------------------------------

export const researchSessions = pgTable("research_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  topic: text("topic").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  summary: text("summary"),
  transcript: jsonb("transcript"),
});

// ---------------------------------------------------------------------------
// Inferred types for external use
// ---------------------------------------------------------------------------

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type Annotation = typeof annotations.$inferSelect;
export type NewAnnotation = typeof annotations.$inferInsert;

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

export type CollectionItem = typeof collectionItems.$inferSelect;
export type NewCollectionItem = typeof collectionItems.$inferInsert;

export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type NewScheduledJob = typeof scheduledJobs.$inferInsert;

export type ResearchSession = typeof researchSessions.$inferSelect;
export type NewResearchSession = typeof researchSessions.$inferInsert;
