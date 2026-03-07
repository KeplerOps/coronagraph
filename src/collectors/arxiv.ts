// ---------------------------------------------------------------------------
// ArXiv API collector  --  fetches recent papers from selected CS categories
// ---------------------------------------------------------------------------

import type { Collector, RawItem } from "./base.ts";

const ARXIV_API = "http://export.arxiv.org/api/query";

const CATEGORIES = ["cs.AI", "cs.CR", "cs.LG", "cs.CL"];
const MAX_RESULTS = 50;

// -- Atom XML helpers ---------------------------------------------------------
// ArXiv returns Atom XML.  We parse it with lightweight regex helpers rather
// than pulling in a full XML library.  The feed is well-structured so this
// approach is reliable for the fields we need.

/**
 * Extract all entry blocks from the Atom feed.
 */
export function extractEntries(xml: string): string[] {
  const entries: string[] = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    entries.push(m[1]!);
  }
  return entries;
}

/**
 * Get the text content of a single XML tag.  Returns undefined when the tag
 * is missing.  Handles multiline content by collapsing whitespace.
 */
export function tag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "m");
  const m = re.exec(xml);
  if (!m) return undefined;
  return m[1]!.replace(/\s+/g, " ").trim();
}

/**
 * Extract the arxiv paper ID from a full URL or id tag content.
 * Input examples:
 *   http://arxiv.org/abs/2501.12345v1
 *   http://arxiv.org/abs/2501.12345
 * Output: "2501.12345"
 */
export function extractArxivId(raw: string): string {
  // Try to pull the ID portion from an abs URL
  const m = raw.match(/arxiv\.org\/abs\/(.+?)(?:v\d+)?$/);
  if (m) return m[1]!;
  // Fallback: strip version suffix if present
  return raw.replace(/v\d+$/, "").trim();
}

/**
 * Collect all category term attribute values.
 */
export function extractCategories(xml: string): string[] {
  const cats: string[] = [];
  const re = /<category[^>]+term="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    cats.push(m[1]!);
  }
  return cats;
}

/**
 * Get the first link whose rel is "alternate" (the HTML abstract page).
 * Falls back to the id tag value.
 */
export function extractUrl(xml: string): string | undefined {
  const linkRe = /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/;
  const m = linkRe.exec(xml);
  if (m) return m[1];
  return tag(xml, "id");
}

// -- Collector ----------------------------------------------------------------

export class ArxivCollector implements Collector {
  readonly source = "arxiv";

  async fetch(): Promise<RawItem[]> {
    try {
      const query = CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
      const url = new URL(ARXIV_API);
      url.searchParams.set("search_query", query);
      url.searchParams.set("sortBy", "submittedDate");
      url.searchParams.set("sortOrder", "descending");
      url.searchParams.set("max_results", String(MAX_RESULTS));

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/atom+xml" },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `ArXiv API responded ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const xml = await res.text();
      return this.parseEntries(xml);
    } catch (err) {
      console.error("[arxiv] Fetch failed:", err);
      return [];
    }
  }

  // --------------------------------------------------------------------------

  private parseEntries(xml: string): RawItem[] {
    const entries = extractEntries(xml);
    const items: RawItem[] = [];

    for (const entry of entries) {
      const idRaw = tag(entry, "id");
      if (!idRaw) continue;

      const title = tag(entry, "title") ?? "(untitled)";
      const summary = tag(entry, "summary");
      const published = tag(entry, "published");
      const paperUrl = extractUrl(entry);
      const categories = extractCategories(entry);

      items.push({
        sourceId: extractArxivId(idRaw),
        itemType: "paper",
        title,
        content: summary,
        url: paperUrl,
        topics: categories,
        publishedAt: published ? new Date(published) : undefined,
      });
    }

    return items;
  }
}
