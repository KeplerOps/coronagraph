import { mock } from "bun:test";
import type { Item, Annotation, Source } from "../../src/db/schema.ts";
import { makeItem } from "../fixtures/items.ts";

/**
 * Default mock implementations for all database query functions.
 * Each can be overridden after calling setupDbMock().
 */
const defaultMocks = {
  insertItem: async (item: unknown) => makeItem(item as Partial<Item>),
  getRecentItems: async () => [] as Item[],
  getItem: async () => null as (Item & { annotations: Annotation[] }) | null,
  searchItems: async () => [] as (Item & { rank: number })[],
  similarItems: async () => [] as (Item & { distance: number })[],
  addAnnotation: async (_itemId: string, note: string) =>
    ({
      id: "00000000-0000-4000-a000-000000000099",
      itemId: _itemId,
      note,
      createdAt: new Date("2025-01-15T12:00:00Z"),
    }) as Annotation,
  upsertSource: async (input: { id: string; name: string; type: string }) =>
    ({
      id: input.id,
      name: input.name,
      type: input.type,
      config: null,
      enabled: true,
      lastFetched: null,
      fetchIntervalMinutes: 30,
    }) as Source,
};

/**
 * Default mock implementations for web-specific query functions.
 */
const defaultWebMocks = {
  getRecentBriefs: async () => [],
  getBrief: async () => null,
  getCollections: async () => [],
  getCollection: async () => null,
  createCollection: async (name: string, description?: string) => ({
    id: "00000000-0000-4000-a000-000000000098",
    name,
    description: description ?? null,
    createdAt: new Date("2025-01-15T12:00:00Z"),
  }),
  getSources: async () => [],
  getScheduledJobs: async () => [],
};

/**
 * Set up mock.module overrides for all database query modules.
 *
 * Returns an object with references to the mock functions so tests
 * can override return values:
 *
 *   const db = setupDbMock();
 *   db.getRecentItems.mockResolvedValue([makeItem()]);
 */
export function setupDbMock() {
  const mocks = { ...defaultMocks };
  const webMocks = { ...defaultWebMocks };

  mock.module("../../src/db/queries.ts", () => mocks);
  mock.module("../../src/db/queries-web.ts", () => webMocks);

  // Also mock the client module to prevent real DB connections
  mock.module("../../src/db/client.ts", () => ({
    db: {},
    client: {},
  }));

  return { ...mocks, ...webMocks };
}
