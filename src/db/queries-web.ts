/**
 * Additional query helpers for the web dashboard.
 * Supplements the core queries in queries.ts with brief, collection,
 * source, and scheduled job access.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client.ts";
import {
  type Brief,
  briefs,
  type Collection,
  collectionItems,
  collections,
  type Item,
  items,
  type ScheduledJob,
  type Source,
  scheduledJobs,
  sources,
} from "./schema.ts";

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export async function getRecentBriefs(limit = 50): Promise<Brief[]> {
  return db
    .select()
    .from(briefs)
    .orderBy(desc(briefs.generatedAt))
    .limit(limit);
}

export async function getBrief(id: string): Promise<Brief | null> {
  const [brief] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.id, id))
    .limit(1);
  return brief ?? null;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface CollectionWithCount extends Collection {
  itemCount: number;
}

export async function getCollections(): Promise<CollectionWithCount[]> {
  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      createdAt: collections.createdAt,
      itemCount: sql<number>`count(${collectionItems.itemId})`.as("item_count"),
    })
    .from(collections)
    .leftJoin(collectionItems, eq(collections.id, collectionItems.collectionId))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt));

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
    itemCount: Number(r.itemCount),
  }));
}

export async function getCollection(
  id: string,
): Promise<(Collection & { items: Item[] }) | null> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);

  if (!collection) return null;

  const collItems = await db
    .select({
      id: items.id,
      source: items.source,
      sourceId: items.sourceId,
      itemType: items.itemType,
      url: items.url,
      title: items.title,
      summary: items.summary,
      content: items.content,
      meta: items.meta,
      topics: items.topics,
      publishedAt: items.publishedAt,
      ingestedAt: items.ingestedAt,
      embedding: items.embedding,
    })
    .from(collectionItems)
    .innerJoin(items, eq(collectionItems.itemId, items.id))
    .where(eq(collectionItems.collectionId, id))
    .orderBy(desc(collectionItems.addedAt));

  return { ...collection, items: collItems };
}

export async function createCollection(
  name: string,
  description?: string,
): Promise<Collection> {
  const [collection] = await db
    .insert(collections)
    .values({ name, description: description ?? null })
    .returning();
  return collection!;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function getSources(): Promise<Source[]> {
  return db.select().from(sources).orderBy(sources.name);
}

// ---------------------------------------------------------------------------
// Scheduled Jobs
// ---------------------------------------------------------------------------

export async function getScheduledJobs(): Promise<ScheduledJob[]> {
  return db.select().from(scheduledJobs).orderBy(scheduledJobs.name);
}
