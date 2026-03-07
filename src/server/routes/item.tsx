import { Hono } from "hono";
import BaseLayout from "../layouts/base.tsx";
import { getItem, addAnnotation } from "../../db/queries.ts";
import type { Annotation } from "../../db/schema.ts";
import { formatDate, relativeTime } from "../lib/format.ts";
import {
  sourceColor,
  typeColor,
  sourceLabel,
  typeLabel,
} from "../lib/badges.ts";
import type { FC } from "hono/jsx";

const item = new Hono();

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const MetaRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div class="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
    <span class="text-xs text-gray-500 font-medium w-28 flex-shrink-0 uppercase tracking-wider">
      {label}
    </span>
    <span class="text-sm text-gray-300 break-all">{value}</span>
  </div>
);

const AnnotationCard: FC<{ annotation: Annotation }> = ({ annotation }) => (
  <div class="bg-gray-900 border border-gray-800 rounded-lg p-3 fade-in">
    <p class="text-sm text-gray-300 whitespace-pre-wrap">{annotation.note}</p>
    <p class="text-xs text-gray-600 mt-2">
      {formatDate(annotation.createdAt)}
    </p>
  </div>
);

const AnnotationList: FC<{ annotations: Annotation[] }> = ({
  annotations,
}) => (
  <div class="space-y-3">
    {annotations.map((a) => (
      <AnnotationCard annotation={a} />
    ))}
    {annotations.length === 0 && (
      <p class="text-sm text-gray-600 italic">No annotations yet</p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// GET /items/:id - Item detail page
// ---------------------------------------------------------------------------

item.get("/items/:id", async (c) => {
  const id = c.req.param("id");
  const result = await getItem(id);

  if (!result) {
    return c.html(
      <BaseLayout title="Not Found">
        <div class="text-center py-20">
          <div class="text-gray-600 text-5xl mb-4">404</div>
          <h1 class="text-xl font-bold text-gray-300 mb-2">Item Not Found</h1>
          <p class="text-sm text-gray-500 mb-6">
            The item you are looking for does not exist or has been removed.
          </p>
          <a
            href="/"
            class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Feed
          </a>
        </div>
      </BaseLayout>,
      404,
    );
  }

  const topics = result.topics ?? [];
  const meta = (result.meta ?? {}) as Record<string, unknown>;

  return c.html(
    <BaseLayout title={result.title}>
      {/* Breadcrumb */}
      <div class="mb-6">
        <a
          href="/"
          class="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Feed
        </a>
        <span class="text-gray-700 mx-2">/</span>
        <span class="text-sm text-gray-400 truncate">{result.title}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div class="lg:col-span-2 space-y-6">
          {/* Header */}
          <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div class="flex items-center gap-2 mb-3">
              <span
                class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${sourceColor(result.source)}`}
              >
                {sourceLabel(result.source)}
              </span>
              <span
                class={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${typeColor(result.itemType)}`}
              >
                {typeLabel(result.itemType)}
              </span>
              <span class="text-xs text-gray-500 ml-auto">
                {relativeTime(result.publishedAt)}
              </span>
            </div>

            <h1 class="text-lg font-bold text-white leading-snug mb-3">
              {result.title}
            </h1>

            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-4"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Original Source
              </a>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <div class="flex flex-wrap gap-1.5 mb-4">
                {topics.map((topic) => (
                  <span class="px-2 py-0.5 text-[10px] text-gray-400 bg-gray-800 border border-gray-700/50 rounded-full">
                    {topic}
                  </span>
                ))}
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div class="mb-4">
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Summary
                </h2>
                <p class="text-sm text-gray-300 leading-relaxed">
                  {result.summary}
                </p>
              </div>
            )}

            {/* Content */}
            {result.content && (
              <div>
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Content
                </h2>
                <div class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                  {result.content}
                </div>
              </div>
            )}
          </div>

          {/* Annotations */}
          <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              Annotations
              <span class="text-xs text-gray-500 font-normal">
                ({result.annotations.length})
              </span>
            </h2>

            {/* Annotation list */}
            <div id="annotations-list" class="mb-4">
              <AnnotationList annotations={result.annotations} />
            </div>

            {/* Add annotation form */}
            <form
              hx-post={`/items/${result.id}/annotations`}
              hx-target="#annotations-list"
              hx-swap="innerHTML"
              hx-on--after-request="this.reset()"
              class="space-y-3"
            >
              <textarea
                name="note"
                placeholder="Add a note..."
                rows={3}
                required
                class="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none placeholder-gray-500 hover:border-gray-600 transition-colors"
              />
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Add Annotation
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div class="space-y-6">
          {/* Metadata */}
          <div class="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 class="text-sm font-semibold text-white mb-3">Details</h2>
            <div class="space-y-0">
              <MetaRow label="Source" value={sourceLabel(result.source)} />
              <MetaRow label="Type" value={typeLabel(result.itemType)} />
              <MetaRow label="Source ID" value={result.sourceId} />
              {result.publishedAt && (
                <MetaRow
                  label="Published"
                  value={formatDate(result.publishedAt)}
                />
              )}
              {result.ingestedAt && (
                <MetaRow
                  label="Ingested"
                  value={formatDate(result.ingestedAt)}
                />
              )}
            </div>
          </div>

          {/* Meta data (JSON fields) */}
          {Object.keys(meta).length > 0 && (
            <div class="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h2 class="text-sm font-semibold text-white mb-3">Metadata</h2>
              <div class="space-y-0">
                {Object.entries(meta).map(([key, val]) => (
                  <MetaRow
                    label={key}
                    value={
                      typeof val === "string" ? val : JSON.stringify(val)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Related items placeholder */}
          <div class="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 class="text-sm font-semibold text-white mb-3">
              Related Items
            </h2>
            <p class="text-xs text-gray-500 italic">
              Related items will be shown here once vector similarity search is
              enabled for this item.
            </p>
          </div>
        </div>
      </div>
    </BaseLayout>,
  );
});

// ---------------------------------------------------------------------------
// POST /items/:id/annotations - Add an annotation (HTMX)
// ---------------------------------------------------------------------------

item.post("/items/:id/annotations", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const note = body["note"];

  if (typeof note !== "string" || !note.trim()) {
    return c.html(
      <p class="text-sm text-red-400">Please enter a note.</p>,
      400,
    );
  }

  await addAnnotation(id, note.trim());

  // Re-fetch the full item to get updated annotations list
  const result = await getItem(id);
  if (!result) {
    return c.html(
      <p class="text-sm text-red-400">Item not found.</p>,
      404,
    );
  }

  return c.html(<AnnotationList annotations={result.annotations} />);
});

export default item;
