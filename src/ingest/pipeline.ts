// ---------------------------------------------------------------------------
// Ingest pipeline  --  processes raw items through summarization, embedding,
// and storage.
// ---------------------------------------------------------------------------

import type { Collector, RawItem } from "../collectors/base.ts";
import { summarize } from "./summarizer.ts";
import { embed } from "./embedder.ts";
import { insertItem } from "../db/queries.ts";
import type { NewItem } from "../db/schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestResult {
  source: string;
  fetched: number;
  ingested: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Single collector ingestion
// ---------------------------------------------------------------------------

/**
 * Fetch items from a single collector, enrich each one with an LLM summary
 * and embedding vector, then persist to the database.
 */
export async function ingestFromCollector(
  collector: Collector,
): Promise<IngestResult> {
  const result: IngestResult = {
    source: collector.source,
    fetched: 0,
    ingested: 0,
    errors: 0,
  };

  console.log(`[ingest] Fetching from ${collector.source}...`);
  const rawItems = await collector.fetch();
  result.fetched = rawItems.length;
  console.log(
    `[ingest] Got ${rawItems.length} items from ${collector.source}`,
  );

  for (const raw of rawItems) {
    try {
      await processItem(raw, collector.source);
      result.ingested++;
    } catch (err) {
      console.error(
        `[ingest] Error processing item ${raw.sourceId}:`,
        err,
      );
      result.errors++;
    }
  }

  console.log(
    `[ingest] ${collector.source}: ${result.ingested} ingested, ${result.errors} errors`,
  );
  return result;
}

// ---------------------------------------------------------------------------
// Process a single raw item
// ---------------------------------------------------------------------------

async function processItem(raw: RawItem, source: string): Promise<void> {
  // Summarize with LLM (falls back gracefully when no API key is set)
  let summary = raw.content?.slice(0, 200) || "";
  let topics = raw.topics ?? [];

  const llmResult = await summarize(
    raw.title,
    raw.content || "",
    raw.itemType,
  );

  if (llmResult) {
    summary = llmResult.summary;
    topics = [...new Set([...topics, ...llmResult.topics])];
  }

  // Generate embedding vector
  const textForEmbedding = [
    raw.title,
    summary,
    raw.content?.slice(0, 2000) || "",
  ].join("\n\n");

  const embedding = await embed(textForEmbedding);

  // Build the database row and persist
  const newItem: NewItem = {
    source,
    sourceId: raw.sourceId,
    itemType: raw.itemType,
    url: raw.url,
    title: raw.title,
    summary,
    content: raw.content,
    meta: raw.meta,
    topics,
    publishedAt: raw.publishedAt,
    embedding: embedding ?? undefined,
  };

  await insertItem(newItem);
}

// ---------------------------------------------------------------------------
// Run all collectors sequentially
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that runs every collector in order and returns per-
 * source result summaries.
 */
export async function ingestAll(
  collectors: Collector[],
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const collector of collectors) {
    const result = await ingestFromCollector(collector);
    results.push(result);
  }
  return results;
}
