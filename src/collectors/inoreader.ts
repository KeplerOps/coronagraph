// ---------------------------------------------------------------------------
// Inoreader RSS feed collector
// ---------------------------------------------------------------------------

import { getConfig } from "../config.ts";
import type { Collector, RawItem } from "./base.ts";

const STREAM_URL =
  "https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list";

/**
 * Strip HTML tags and collapse whitespace so we get clean plain-text content.
 * Keeps a reasonable amount -- up to 4 000 characters.
 */
export function stripHtml(html: string, maxLen = 4_000): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Inoreader category strings look like:
 *   "user/1234567/label/Security"
 *   "user/1234567/state/com.google/reading-list"
 *
 * We extract the human-readable label portion after /label/.
 */
export function extractTopics(categories: string[] | undefined): string[] {
  if (!categories) return [];
  const topics: string[] = [];
  for (const cat of categories) {
    const match = cat.match(/\/label\/(.+)$/);
    if (match?.[1]) {
      topics.push(match[1].toLowerCase().trim());
    }
  }
  return topics;
}

// -- Inoreader API response shape (subset) ------------------------------------

interface InoreaderItem {
  id: string;
  title: string;
  canonical?: { href: string }[];
  alternate?: { href: string }[];
  summary?: { content: string };
  categories?: string[];
  published?: number; // unix seconds
  origin?: { title?: string; htmlUrl?: string };
}

interface InoreaderResponse {
  items: InoreaderItem[];
  continuation?: string;
}

// -----------------------------------------------------------------------------

export class InoreaderCollector implements Collector {
  readonly source = "inoreader";

  async fetch(): Promise<RawItem[]> {
    const cfg = getConfig();
    const appId = cfg.INOREADER_APP_ID;
    const appKey = cfg.INOREADER_APP_KEY;
    const token = cfg.INOREADER_TOKEN;

    if (!appId || !appKey || !token) {
      console.warn(
        "[inoreader] Skipping -- INOREADER_APP_ID, INOREADER_APP_KEY, or INOREADER_TOKEN not configured",
      );
      return [];
    }

    try {
      return await this.fetchItems(appId, appKey, token);
    } catch (err) {
      console.error("[inoreader] Fetch failed:", err);
      return [];
    }
  }

  // --------------------------------------------------------------------------

  private async fetchItems(
    appId: string,
    appKey: string,
    token: string,
  ): Promise<RawItem[]> {
    const items: RawItem[] = [];
    let continuation: string | undefined;

    // Fetch up to 100 items (one page). We accept a continuation token for
    // future multi-page support but cap at a single request for now.
    const url = new URL(STREAM_URL);
    url.searchParams.set("n", "100"); // items per page
    if (continuation) {
      url.searchParams.set("c", continuation);
    }

    const res = await fetch(url.toString(), {
      headers: {
        AppId: appId,
        AppKey: appKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Inoreader API responded ${res.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as InoreaderResponse;
    continuation = data.continuation;

    for (const entry of data.items ?? []) {
      const rawUrl =
        entry.canonical?.[0]?.href ?? entry.alternate?.[0]?.href ?? undefined;

      const rawContent = entry.summary?.content ?? "";

      items.push({
        sourceId: entry.id,
        itemType: "article",
        url: rawUrl,
        title: entry.title ?? "(untitled)",
        content: stripHtml(rawContent),
        meta: {
          origin: entry.origin?.title,
          originUrl: entry.origin?.htmlUrl,
        },
        topics: extractTopics(entry.categories),
        publishedAt: entry.published
          ? new Date(entry.published * 1_000)
          : undefined,
      });
    }

    return items;
  }
}
