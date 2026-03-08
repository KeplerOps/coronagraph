import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { db } from "./client";
import {
  type Annotation,
  annotations,
  type Item,
  items,
  type NewItem,
  type Source,
  sources,
} from "./schema";

// ---------------------------------------------------------------------------
// insertItem  --  upsert (insert or do nothing on source+source_id conflict)
// ---------------------------------------------------------------------------

export async function insertItem(item: NewItem): Promise<Item> {
  const [inserted] = await db
    .insert(items)
    .values(item)
    .onConflictDoNothing({
      target: [items.source, items.sourceId],
    })
    .returning();

  // If the row already existed the RETURNING clause comes back empty.
  // In that case, fetch the existing row so callers always get a result.
  if (!inserted) {
    const [existing] = await db
      .select()
      .from(items)
      .where(
        and(eq(items.source, item.source), eq(items.sourceId, item.sourceId)),
      )
      .limit(1);
    if (!existing)
      throw new Error(`Item not found: ${item.source}/${item.sourceId}`);
    return existing;
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// getRecentItems  --  paginated list with optional filters
// ---------------------------------------------------------------------------

export interface RecentItemsOpts {
  source?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export async function getRecentItems(
  opts: RecentItemsOpts = {},
): Promise<Item[]> {
  const { source, type, limit = 50, offset = 0 } = opts;

  const conditions: SQL[] = [];
  if (source) conditions.push(eq(items.source, source));
  if (type) conditions.push(eq(items.itemType, type));

  const query = db
    .select()
    .from(items)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(items.publishedAt))
    .limit(limit)
    .offset(offset);

  return query;
}

// ---------------------------------------------------------------------------
// searchItems  --  PostgreSQL full-text search on title + content
// ---------------------------------------------------------------------------

export async function searchItems(
  query: string,
  limit = 20,
): Promise<(Item & { rank: number })[]> {
  const tsQuery = sql`plainto_tsquery('english', ${query})`;
  const tsVector = sql`to_tsvector('english', coalesce(${items.title}, '') || ' ' || coalesce(${items.content}, ''))`;

  const results = await db
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
      rank: sql<number>`ts_rank(${tsVector}, ${tsQuery})`.as("rank"),
    })
    .from(items)
    .where(sql`${tsVector} @@ ${tsQuery}`)
    .orderBy(sql`rank DESC`)
    .limit(limit);

  return results;
}

// ---------------------------------------------------------------------------
// similarItems  --  vector cosine similarity via pgvector
// ---------------------------------------------------------------------------

export async function similarItems(
  embedding: number[],
  limit = 10,
): Promise<(Item & { distance: number })[]> {
  const vectorLiteral = `[${embedding.join(",")}]`;

  const results = await db
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
      distance: sql<number>`${items.embedding} <=> ${vectorLiteral}::vector`.as(
        "distance",
      ),
    })
    .from(items)
    .orderBy(sql`${items.embedding} <=> ${vectorLiteral}::vector`)
    .limit(limit);

  return results;
}

// ---------------------------------------------------------------------------
// getItem  --  single item by ID, with its annotations
// ---------------------------------------------------------------------------

export async function getItem(
  id: string,
): Promise<(Item & { annotations: Annotation[] }) | null> {
  const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);

  if (!item) return null;

  const itemAnnotations = await db
    .select()
    .from(annotations)
    .where(eq(annotations.itemId, id))
    .orderBy(desc(annotations.createdAt));

  return { ...item, annotations: itemAnnotations };
}

// ---------------------------------------------------------------------------
// addAnnotation  --  attach a note to an item
// ---------------------------------------------------------------------------

export async function addAnnotation(
  itemId: string,
  note: string,
): Promise<Annotation> {
  const [annotation] = await db
    .insert(annotations)
    .values({ itemId, note })
    .returning();

  if (!annotation) throw new Error("Failed to insert annotation");
  return annotation;
}

// ---------------------------------------------------------------------------
// upsertSource  --  insert or update a source record
// ---------------------------------------------------------------------------

export interface UpsertSourceInput {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
}

export async function upsertSource(input: UpsertSourceInput): Promise<Source> {
  const config: Record<string, string> = {};
  if (input.url) config.url = input.url;
  if (input.description) config.description = input.description;

  const [result] = await db
    .insert(sources)
    .values({
      id: input.id,
      name: input.name,
      type: input.type,
      config: Object.keys(config).length > 0 ? config : null,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        name: input.name,
        type: input.type,
        config: Object.keys(config).length > 0 ? config : null,
      },
    })
    .returning();

  if (!result) throw new Error(`Failed to upsert source: ${input.id}`);
  return result;
}
