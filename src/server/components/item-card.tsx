import type { FC } from "hono/jsx";
import type { Item } from "../../db/schema.ts";
import {
  sourceColor,
  sourceLabel,
  typeColor,
  typeLabel,
} from "../lib/badges.ts";
import { relativeTime, truncate } from "../lib/format.ts";

export const ItemCard: FC<{ item: Item }> = ({ item }) => {
  const timeAgo = relativeTime(item.publishedAt);
  const summaryText = truncate(item.summary ?? item.content, 200);
  const topics = item.topics ?? [];

  return (
    <a
      href={`/items/${item.id}`}
      class="item-card block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 fade-in"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          {/* Title */}
          <h3 class="text-sm font-semibold text-gray-100 leading-snug mb-1.5 line-clamp-2">
            {item.title}
          </h3>

          {/* Summary */}
          {summaryText && (
            <p class="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-3">
              {summaryText}
            </p>
          )}

          {/* Badges and meta */}
          <div class="flex items-center flex-wrap gap-2">
            {/* Source badge */}
            <span
              class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${sourceColor(item.source)}`}
            >
              {sourceLabel(item.source)}
            </span>

            {/* Type badge */}
            <span
              class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${typeColor(item.itemType)}`}
            >
              {typeLabel(item.itemType)}
            </span>

            {/* Topics */}
            {topics.slice(0, 3).map((topic) => (
              <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-800 rounded">
                {topic}
              </span>
            ))}
            {topics.length > 3 && (
              <span class="text-[10px] text-gray-600">
                +{topics.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <span class="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0 mt-0.5">
          {timeAgo}
        </span>
      </div>
    </a>
  );
};

/**
 * Renders a list of item cards, used for HTMX partials.
 */
export const ItemCardList: FC<{
  items: Item[];
  offset?: number;
  limit?: number;
  source?: string;
  type?: string;
  q?: string;
  hasMore?: boolean;
}> = ({ items, offset = 0, limit = 30, source, type, q, hasMore = true }) => {
  const nextOffset = offset + items.length;

  // Build query string for load more
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  params.set("limit", String(limit));
  params.set("offset", String(nextOffset));

  return (
    <div>
      <div class="space-y-3">
        {items.map((item) => (
          <ItemCard item={item} />
        ))}
      </div>

      {items.length === 0 && (
        <div class="text-center py-16">
          <div class="text-gray-600 text-4xl mb-3">[ ]</div>
          <p class="text-gray-500 text-sm">No items found</p>
          <p class="text-gray-600 text-xs mt-1">
            Try adjusting your filters or check back later
          </p>
        </div>
      )}

      {/* Load more button */}
      {items.length > 0 && hasMore && (
        <div class="mt-6 text-center">
          <button
            type="button"
            hx-get={`/feed/items?${params.toString()}`}
            hx-target="#items-list"
            hx-swap="innerHTML"
            class="px-4 py-2 text-sm text-gray-400 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 hover:text-gray-200 hover:border-gray-700 transition-colors"
          >
            <span class="htmx-indicator mr-2">Loading...</span>
            Load more
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemCard;
