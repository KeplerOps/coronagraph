// ---------------------------------------------------------------------------
// Coronagraph MCP Server
//
// Exposes the intelligence platform's knowledge base to LLM clients via the
// Model Context Protocol.  Run with:  bun run src/mcp/server.ts
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { db } from "../db/client.ts";
import {
  items,
  collections,
  briefs,
  type Item,
} from "../db/schema.ts";
import {
  searchItems,
  similarItems,
  getRecentItems,
  getItem,
  addAnnotation,
} from "../db/queries.ts";
import { embed } from "../ingest/embedder.ts";
import { getConfig } from "../config.ts";
import { desc, and, eq, gte, sql, type SQL } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a single Item into a readable text block for MCP responses. */
function formatItem(item: Item): string {
  const parts: string[] = [];
  parts.push(`Title: ${item.title}`);
  if (item.summary) parts.push(`Summary: ${item.summary}`);
  parts.push(`Source: ${item.source}`);
  parts.push(`Type: ${item.itemType}`);
  if (item.url) parts.push(`URL: ${item.url}`);
  if (item.publishedAt) parts.push(`Published: ${item.publishedAt.toISOString()}`);
  if (item.topics && item.topics.length > 0) parts.push(`Topics: ${item.topics.join(", ")}`);
  parts.push(`ID: ${item.id}`);
  return parts.join("\n");
}

/** Format a list of items into a numbered text block. */
function formatItemList(resultItems: Item[]): string {
  if (resultItems.length === 0) return "No items found.";
  return resultItems
    .map((item, i) => `--- [${i + 1}] ---\n${formatItem(item)}`)
    .join("\n\n");
}

/** Deduplicate items by ID, preserving order of first occurrence. */
function deduplicateById(itemList: Item[]): Item[] {
  const seen = new Set<string>();
  const unique: Item[] = [];
  for (const item of itemList) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  return unique;
}

/** Lazily initialise the Anthropic client for brief generation. */
function getAnthropicClient(): Anthropic | null {
  const config = getConfig();
  if (!config.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "coronagraph",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: search_knowledge
// ---------------------------------------------------------------------------

server.tool(
  "search_knowledge",
  "Combined vector and full-text search across the Coronagraph knowledge base. " +
    "Returns intelligence items matching the query, ranked by relevance.",
  {
    query: z.string().describe("The search query string"),
    source: z.string().optional().describe("Filter by source (e.g. 'arxiv', 'rss')"),
    type: z.string().optional().describe("Filter by item type (e.g. 'paper', 'article')"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ query, source, type, limit }) => {
    try {
      // 1. Full-text search
      const textResults = await searchItems(query, limit * 2);

      // 2. Attempt vector search -- requires an embedding API key
      let vectorResults: Item[] = [];
      try {
        const queryEmbedding = await embed(query);
        if (queryEmbedding) {
          vectorResults = await similarItems(queryEmbedding, limit * 2);
        }
      } catch (err) {
        // Vector search is best-effort; log and continue with text results
        console.error("[mcp] Vector search failed:", err);
      }

      // 3. Merge and deduplicate
      let combined = deduplicateById([...textResults, ...vectorResults]);

      // 4. Apply optional filters
      if (source) {
        combined = combined.filter((item) => item.source === source);
      }
      if (type) {
        combined = combined.filter((item) => item.itemType === type);
      }

      // 5. Trim to requested limit
      combined = combined.slice(0, limit);

      const resultText =
        `Found ${combined.length} result(s) for "${query}":\n\n` +
        formatItemList(combined);

      return { content: [{ type: "text" as const, text: resultText }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Search failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: get_recent
// ---------------------------------------------------------------------------

server.tool(
  "get_recent",
  "Retrieve the most recent intelligence items from the knowledge base, " +
    "optionally filtered by source or item type.",
  {
    source: z.string().optional().describe("Filter by source (e.g. 'arxiv', 'rss')"),
    type: z.string().optional().describe("Filter by item type (e.g. 'paper', 'article')"),
    limit: z.number().optional().default(20).describe("Maximum number of items to return"),
  },
  async ({ source, type, limit }) => {
    try {
      const results = await getRecentItems({ source, type, limit });

      const resultText =
        `${results.length} recent item(s):\n\n` + formatItemList(results);

      return { content: [{ type: "text" as const, text: resultText }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to fetch recent items: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: get_item
// ---------------------------------------------------------------------------

server.tool(
  "get_item",
  "Retrieve the full details of a single intelligence item by its ID, " +
    "including content, metadata, and all annotations.",
  {
    id: z.string().describe("The UUID of the item to retrieve"),
  },
  async ({ id }) => {
    try {
      const item = await getItem(id);

      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Item not found: ${id}` }],
          isError: true,
        };
      }

      const parts: string[] = [formatItem(item)];

      if (item.content) {
        parts.push(`\nContent:\n${item.content}`);
      }

      if (item.meta) {
        parts.push(`\nMetadata:\n${JSON.stringify(item.meta, null, 2)}`);
      }

      if (item.annotations && item.annotations.length > 0) {
        const annotationBlock = item.annotations
          .map(
            (a) =>
              `  [${a.createdAt?.toISOString() ?? "unknown"}] ${a.note}`,
          )
          .join("\n");
        parts.push(`\nAnnotations (${item.annotations.length}):\n${annotationBlock}`);
      }

      return { content: [{ type: "text" as const, text: parts.join("\n") }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to get item: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: annotate
// ---------------------------------------------------------------------------

server.tool(
  "annotate",
  "Save an analyst note or annotation on an intelligence item. " +
    "Useful for tagging insights, marking items for follow-up, or recording analysis.",
  {
    item_id: z.string().describe("The UUID of the item to annotate"),
    note: z.string().describe("The annotation text to attach to the item"),
  },
  async ({ item_id, note }) => {
    try {
      const annotation = await addAnnotation(item_id, note);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Annotation saved (ID: ${annotation.id}).\n` +
              `Item: ${item_id}\n` +
              `Note: ${note}\n` +
              `Created: ${annotation.createdAt?.toISOString() ?? "now"}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to save annotation: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_collection
// ---------------------------------------------------------------------------

server.tool(
  "create_collection",
  "Create a new research collection for organizing related intelligence items.",
  {
    name: z.string().describe("Name of the collection"),
    description: z.string().optional().describe("Optional description of the collection's purpose"),
  },
  async ({ name, description }) => {
    try {
      const [collection] = await db
        .insert(collections)
        .values({ name, description })
        .returning();

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Collection created.\n` +
              `ID: ${collection.id}\n` +
              `Name: ${collection.name}\n` +
              (collection.description
                ? `Description: ${collection.description}\n`
                : "") +
              `Created: ${collection.createdAt?.toISOString() ?? "now"}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to create collection: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: generate_brief
// ---------------------------------------------------------------------------

server.tool(
  "generate_brief",
  "Generate an on-demand intelligence brief by synthesizing recent items " +
    "from the knowledge base. Requires ANTHROPIC_API_KEY to be configured.",
  {
    topics: z
      .array(z.string())
      .optional()
      .describe("Optional list of topic tags to filter items (e.g. ['llm-security', 'supply-chain'])"),
    time_range_hours: z
      .number()
      .optional()
      .default(24)
      .describe("How far back to look for items, in hours"),
  },
  async ({ topics, time_range_hours }) => {
    try {
      // 1. Build query conditions
      const cutoff = new Date(Date.now() - time_range_hours * 60 * 60 * 1000);
      const conditions: SQL[] = [gte(items.publishedAt, cutoff)];

      // If topics are provided, filter items that have at least one matching topic
      if (topics && topics.length > 0) {
        conditions.push(
          sql`${items.topics} && ${sql`ARRAY[${sql.join(
            topics.map((t) => sql`${t}`),
            sql`,`,
          )}]::text[]`}`,
        );
      }

      const recentItems = await db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(desc(items.publishedAt))
        .limit(50);

      if (recentItems.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "No items found matching the specified criteria. " +
                `Searched the last ${time_range_hours} hour(s)` +
                (topics ? ` with topics: ${topics.join(", ")}` : "") +
                ".",
            },
          ],
        };
      }

      // 2. Build context for the LLM
      const itemSummaries = recentItems
        .map(
          (item, i) =>
            `[${i + 1}] ${item.title}` +
            (item.summary ? `\n   ${item.summary}` : "") +
            (item.source ? `\n   Source: ${item.source}` : "") +
            (item.url ? `\n   URL: ${item.url}` : ""),
        )
        .join("\n\n");

      const topicLabel =
        topics && topics.length > 0
          ? `focusing on: ${topics.join(", ")}`
          : "across all topics";

      const prompt = `You are a senior intelligence analyst. Synthesize the following ${recentItems.length} items from the last ${time_range_hours} hour(s) (${topicLabel}) into a concise intelligence brief.

Structure your brief with:
1. **Executive Summary** - 2-3 sentences capturing the most significant developments
2. **Key Developments** - Bullet points of the most important items with context
3. **Emerging Trends** - Patterns or trends you notice across items
4. **Recommended Actions** - What an analyst should pay attention to or investigate further

Items:
${itemSummaries}

Write the brief in clear, professional language. Reference specific items by their number when relevant.`;

      // 3. Generate the brief with the Anthropic API
      const anthropic = getAnthropicClient();

      if (!anthropic) {
        // Fall back to a simple aggregation when no API key is available
        const fallbackBrief =
          `Intelligence Brief (last ${time_range_hours}h)\n` +
          `Generated: ${new Date().toISOString()}\n` +
          `Items: ${recentItems.length}\n` +
          (topics ? `Topics: ${topics.join(", ")}\n` : "") +
          `\n---\n\n` +
          `Note: ANTHROPIC_API_KEY is not configured. Showing raw item summaries.\n\n` +
          itemSummaries;

        // Store the fallback brief
        const [stored] = await db
          .insert(briefs)
          .values({
            briefType: "on-demand",
            title: `Brief: ${topicLabel} (last ${time_range_hours}h)`,
            content: fallbackBrief,
            itemsUsed: recentItems.map((item) => item.id),
          })
          .returning();

        return {
          content: [
            {
              type: "text" as const,
              text: `${fallbackBrief}\n\n---\nBrief ID: ${stored.id}`,
            },
          ],
        };
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const briefContent =
        response.content[0]?.type === "text"
          ? response.content[0].text
          : "Failed to generate brief content.";

      const briefTitle = `Intelligence Brief: ${topicLabel} (last ${time_range_hours}h)`;

      // 4. Store the brief in the database
      const [stored] = await db
        .insert(briefs)
        .values({
          briefType: "on-demand",
          title: briefTitle,
          content: briefContent,
          itemsUsed: recentItems.map((item) => item.id),
        })
        .returning();

      const resultText =
        `${briefTitle}\n` +
        `Generated: ${stored.generatedAt?.toISOString() ?? new Date().toISOString()}\n` +
        `Based on: ${recentItems.length} item(s)\n` +
        `Brief ID: ${stored.id}\n` +
        `\n---\n\n` +
        briefContent;

      return { content: [{ type: "text" as const, text: resultText }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to generate brief: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[coronagraph-mcp] Server started on stdio transport");
}

main().catch((err) => {
  console.error("[coronagraph-mcp] Fatal error:", err);
  process.exit(1);
});
