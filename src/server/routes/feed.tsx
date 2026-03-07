import { Hono } from "hono";
import BaseLayout from "../layouts/base.tsx";
import { Filters } from "../components/filters.tsx";
import { ItemCardList } from "../components/item-card.tsx";
import { getRecentItems, searchItems } from "../../db/queries.ts";

const feed = new Hono();

// ---------------------------------------------------------------------------
// GET / - Full feed page
// ---------------------------------------------------------------------------

feed.get("/", async (c) => {
  const source = c.req.query("source") ?? "";
  const type = c.req.query("type") ?? "";
  const q = c.req.query("q") ?? "";
  const limit = 30;

  let items;
  if (q) {
    const results = await searchItems(q, limit);
    // Apply additional filters if set
    items = results.filter((item) => {
      if (source && item.source !== source) return false;
      if (type && item.itemType !== type) return false;
      return true;
    });
  } else {
    items = await getRecentItems({
      source: source || undefined,
      type: type || undefined,
      limit,
      offset: 0,
    });
  }

  return c.html(
    <BaseLayout title="Feed">
      {/* Page header */}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-xl font-bold text-white">Intelligence Feed</h1>
            <p class="text-sm text-gray-500 mt-0.5">
              Latest security intelligence from all sources
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
              <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-dot" />
              Live
            </span>
          </div>
        </div>

        {/* Filters */}
        <Filters
          currentSource={source}
          currentType={type}
          currentQuery={q}
        />
      </div>

      {/* Items list */}
      <div id="items-list">
        <ItemCardList
          items={items}
          offset={0}
          limit={limit}
          source={source}
          type={type}
          q={q}
          hasMore={items.length >= limit}
        />
      </div>
    </BaseLayout>,
  );
});

// ---------------------------------------------------------------------------
// GET /feed/items - HTMX partial for filtered/paginated items
// ---------------------------------------------------------------------------

feed.get("/feed/items", async (c) => {
  const source = c.req.query("source") ?? "";
  const type = c.req.query("type") ?? "";
  const q = c.req.query("q") ?? "";
  const limitRaw = parseInt(c.req.query("limit") ?? "30", 10);
  const offsetRaw = parseInt(c.req.query("offset") ?? "0", 10);
  const limit = Math.min(Number.isNaN(limitRaw) ? 30 : Math.max(0, limitRaw), 200);
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

  let items;
  if (q) {
    const results = await searchItems(q, limit + offset);
    // Apply additional filters if set
    const filtered = results.filter((item) => {
      if (source && item.source !== source) return false;
      if (type && item.itemType !== type) return false;
      return true;
    });
    items = filtered.slice(offset, offset + limit);
  } else {
    items = await getRecentItems({
      source: source || undefined,
      type: type || undefined,
      limit,
      offset,
    });
  }

  return c.html(
    <ItemCardList
      items={items}
      offset={offset}
      limit={limit}
      source={source}
      type={type}
      q={q}
      hasMore={items.length >= limit}
    />,
  );
});

export default feed;
