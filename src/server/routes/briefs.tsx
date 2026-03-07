import { Hono } from "hono";
import BaseLayout from "../layouts/base.tsx";
import { getRecentBriefs, getBrief } from "../../db/queries-web.ts";
import { formatDate, relativeTime } from "../lib/format.ts";
import type { FC } from "hono/jsx";
import type { Brief } from "../../db/schema.ts";

const briefsApp = new Hono();

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const BRIEF_TYPE_STYLES: Record<string, string> = {
  daily: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  weekly: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  flash: "bg-red-500/15 text-red-400 border-red-500/20",
  research: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const briefTypeStyle = (type: string) =>
  BRIEF_TYPE_STYLES[type.toLowerCase()] ??
  "bg-gray-500/15 text-gray-400 border-gray-500/20";

const BriefRow: FC<{ brief: Brief }> = ({ brief }) => (
  <a
    href={`/briefs/${brief.id}`}
    class="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 item-card fade-in"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1.5">
          <span
            class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${briefTypeStyle(brief.briefType)}`}
          >
            {brief.briefType}
          </span>
        </div>
        <h3 class="text-sm font-semibold text-gray-100 line-clamp-1">
          {brief.title ?? "Untitled Brief"}
        </h3>
        <p class="text-xs text-gray-500 mt-1 line-clamp-2">
          {brief.content.slice(0, 200)}
        </p>
      </div>
      <span class="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0 mt-0.5">
        {relativeTime(brief.generatedAt)}
      </span>
    </div>
  </a>
);

// ---------------------------------------------------------------------------
// GET /briefs - Briefs list
// ---------------------------------------------------------------------------

briefsApp.get("/briefs", async (c) => {
  const briefs = await getRecentBriefs(100);

  return c.html(
    <BaseLayout title="Briefs">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-white">Intelligence Briefs</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Automated intelligence summaries and analysis reports
        </p>
      </div>

      {briefs.length > 0 ? (
        <div class="space-y-3">
          {briefs.map((b) => (
            <BriefRow brief={b} />
          ))}
        </div>
      ) : (
        <div class="text-center py-16">
          <div class="text-gray-600 text-4xl mb-3">[ ]</div>
          <p class="text-gray-500 text-sm">No briefs generated yet</p>
          <p class="text-gray-600 text-xs mt-1">
            Briefs are generated automatically based on your scheduled jobs
          </p>
        </div>
      )}
    </BaseLayout>,
  );
});

// ---------------------------------------------------------------------------
// GET /briefs/:id - Brief detail page
// ---------------------------------------------------------------------------

briefsApp.get("/briefs/:id", async (c) => {
  const id = c.req.param("id");
  const brief = await getBrief(id);

  if (!brief) {
    return c.html(
      <BaseLayout title="Not Found">
        <div class="text-center py-20">
          <div class="text-gray-600 text-5xl mb-4">404</div>
          <h1 class="text-xl font-bold text-gray-300 mb-2">
            Brief Not Found
          </h1>
          <p class="text-sm text-gray-500 mb-6">
            This brief does not exist or has been removed.
          </p>
          <a
            href="/briefs"
            class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Briefs
          </a>
        </div>
      </BaseLayout>,
      404,
    );
  }

  // Simple markdown-ish rendering: split into paragraphs, handle headers and lists
  const contentLines = brief.content.split("\n");

  return c.html(
    <BaseLayout title={brief.title ?? "Brief"}>
      {/* Breadcrumb */}
      <div class="mb-6">
        <a
          href="/briefs"
          class="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Briefs
        </a>
        <span class="text-gray-700 mx-2">/</span>
        <span class="text-sm text-gray-400 truncate">
          {brief.title ?? "Untitled Brief"}
        </span>
      </div>

      <div class="max-w-3xl">
        {/* Header */}
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <span
              class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${briefTypeStyle(brief.briefType)}`}
            >
              {brief.briefType}
            </span>
            <span class="text-xs text-gray-500">
              {formatDate(brief.generatedAt)}
            </span>
          </div>
          <h1 class="text-xl font-bold text-white leading-snug">
            {brief.title ?? "Untitled Brief"}
          </h1>
        </div>

        {/* Content */}
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div class="prose-invert max-w-none">
            {contentLines.map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return <div class="h-3" />;

              // Headings
              if (trimmed.startsWith("### "))
                return (
                  <h3 class="text-sm font-bold text-white mt-4 mb-2">
                    {trimmed.slice(4)}
                  </h3>
                );
              if (trimmed.startsWith("## "))
                return (
                  <h2 class="text-base font-bold text-white mt-5 mb-2">
                    {trimmed.slice(3)}
                  </h2>
                );
              if (trimmed.startsWith("# "))
                return (
                  <h1 class="text-lg font-bold text-white mt-6 mb-3">
                    {trimmed.slice(2)}
                  </h1>
                );

              // List items
              if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
                return (
                  <div class="flex gap-2 ml-2 mb-1">
                    <span class="text-gray-600 mt-0.5">-</span>
                    <p class="text-sm text-gray-300 leading-relaxed">
                      {trimmed.slice(2)}
                    </p>
                  </div>
                );

              // Numbered list
              if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\.\s(.+)/);
                if (match)
                  return (
                    <div class="flex gap-2 ml-2 mb-1">
                      <span class="text-gray-500 text-sm mt-0.5 w-4 flex-shrink-0 text-right">
                        {match[1]}.
                      </span>
                      <p class="text-sm text-gray-300 leading-relaxed">
                        {match[2]}
                      </p>
                    </div>
                  );
              }

              // Regular paragraph
              return (
                <p class="text-sm text-gray-300 leading-relaxed mb-2">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </div>

        {/* Items used */}
        {brief.itemsUsed && brief.itemsUsed.length > 0 && (
          <div class="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 class="text-sm font-semibold text-white mb-3">
              Source Items ({brief.itemsUsed.length})
            </h2>
            <div class="space-y-1">
              {brief.itemsUsed.map((itemId) => (
                <a
                  href={`/items/${itemId}`}
                  class="block text-xs text-blue-400 hover:text-blue-300 transition-colors py-0.5"
                >
                  {itemId}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseLayout>,
  );
});

export default briefsApp;
