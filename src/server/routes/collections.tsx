import { Hono } from "hono";
import type { FC } from "hono/jsx";
import {
  type CollectionWithCount,
  createCollection,
  getCollection,
  getCollections,
} from "../../db/queries-web.ts";
import { ItemCard } from "../components/item-card.tsx";
import BaseLayout from "../layouts/base.tsx";
import { formatDate, relativeTime } from "../lib/format.ts";

const collectionsApp = new Hono();

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const CollectionCard: FC<{ collection: CollectionWithCount }> = ({
  collection,
}) => (
  <a
    href={`/collections/${collection.id}`}
    class="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 item-card fade-in"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-100 mb-1">
          {collection.name}
        </h3>
        {collection.description && (
          <p class="text-xs text-gray-500 line-clamp-2 mb-2">
            {collection.description}
          </p>
        )}
        <div class="flex items-center gap-3 text-xs text-gray-500">
          <span class="inline-flex items-center gap-1">
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            {collection.itemCount} item{collection.itemCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <span class="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0 mt-0.5">
        {relativeTime(collection.createdAt)}
      </span>
    </div>
  </a>
);

const CollectionList: FC<{ collections: CollectionWithCount[] }> = ({
  collections,
}) => (
  <div class="space-y-3">
    {collections.map((col) => (
      <CollectionCard collection={col} />
    ))}
    {collections.length === 0 && (
      <div class="text-center py-12">
        <p class="text-gray-500 text-sm">No collections yet</p>
        <p class="text-gray-600 text-xs mt-1">
          Create a collection to organize intelligence items
        </p>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// GET /collections - Collections list
// ---------------------------------------------------------------------------

collectionsApp.get("/collections", async (c) => {
  const cols = await getCollections();

  return c.html(
    <BaseLayout title="Collections">
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-white">Collections</h1>
            <p class="text-sm text-gray-500 mt-0.5">
              Organize intelligence items into themed collections
            </p>
          </div>
        </div>
      </div>

      {/* Create collection form */}
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
        <h2 class="text-sm font-semibold text-white mb-3">
          Create New Collection
        </h2>
        <form
          hx-post="/collections"
          hx-target="#collections-list"
          hx-swap="innerHTML"
          hx-on--after-request="this.reset()"
          class="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            name="name"
            placeholder="Collection name"
            required
            class="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-500 hover:border-gray-600 transition-colors"
          />
          <input
            type="text"
            name="description"
            placeholder="Description (optional)"
            class="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-500 hover:border-gray-600 transition-colors"
          />
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
          >
            Create Collection
          </button>
        </form>
      </div>

      {/* Collections list */}
      <div id="collections-list">
        <CollectionList collections={cols} />
      </div>
    </BaseLayout>,
  );
});

// ---------------------------------------------------------------------------
// POST /collections - Create a new collection (HTMX)
// ---------------------------------------------------------------------------

collectionsApp.post("/collections", async (c) => {
  const body = await c.req.parseBody();
  const name = body["name"];
  const description = body["description"];

  if (typeof name !== "string" || !name.trim()) {
    return c.html(
      <p class="text-sm text-red-400 py-2">Please enter a collection name.</p>,
      400,
    );
  }

  await createCollection(
    name.trim(),
    typeof description === "string" && description.trim()
      ? description.trim()
      : undefined,
  );

  // Re-fetch and return the updated list
  const cols = await getCollections();
  return c.html(<CollectionList collections={cols} />);
});

// ---------------------------------------------------------------------------
// GET /collections/:id - Collection detail page
// ---------------------------------------------------------------------------

collectionsApp.get("/collections/:id", async (c) => {
  const id = c.req.param("id");
  const collection = await getCollection(id);

  if (!collection) {
    return c.html(
      <BaseLayout title="Not Found">
        <div class="text-center py-20">
          <div class="text-gray-600 text-5xl mb-4">404</div>
          <h1 class="text-xl font-bold text-gray-300 mb-2">
            Collection Not Found
          </h1>
          <p class="text-sm text-gray-500 mb-6">
            This collection does not exist or has been removed.
          </p>
          <a
            href="/collections"
            class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Collections
          </a>
        </div>
      </BaseLayout>,
      404,
    );
  }

  return c.html(
    <BaseLayout title={collection.name}>
      {/* Breadcrumb */}
      <div class="mb-6">
        <a
          href="/collections"
          class="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Collections
        </a>
        <span class="text-gray-700 mx-2">/</span>
        <span class="text-sm text-gray-400">{collection.name}</span>
      </div>

      <div class="mb-6">
        <h1 class="text-xl font-bold text-white">{collection.name}</h1>
        {collection.description && (
          <p class="text-sm text-gray-500 mt-1">{collection.description}</p>
        )}
        <p class="text-xs text-gray-600 mt-2">
          Created {formatDate(collection.createdAt)}
          {" -- "}
          {collection.items.length} item
          {collection.items.length !== 1 ? "s" : ""}
        </p>
      </div>

      {collection.items.length > 0 ? (
        <div class="space-y-3">
          {collection.items.map((item) => (
            <ItemCard item={item} />
          ))}
        </div>
      ) : (
        <div class="text-center py-16">
          <div class="text-gray-600 text-4xl mb-3">[ ]</div>
          <p class="text-gray-500 text-sm">No items in this collection</p>
          <p class="text-gray-600 text-xs mt-1">
            Items can be added to collections via the API
          </p>
        </div>
      )}
    </BaseLayout>,
  );
});

export default collectionsApp;
