import { beforeEach, describe, expect, it, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing app
// ---------------------------------------------------------------------------

const mockGetRecentItems = mock(() => Promise.resolve([]));
const mockGetItem = mock(() => Promise.resolve(null));

mock.module("../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

mock.module("../../src/db/queries.ts", () => ({
  getRecentItems: mockGetRecentItems,
  getItem: mockGetItem,
  searchItems: mock(() => Promise.resolve([])),
  addAnnotation: mock(() => Promise.resolve(null)),
}));

mock.module("../../src/db/queries-web.ts", () => ({
  getRecentBriefs: mock(() => Promise.resolve([])),
  getBrief: mock(() => Promise.resolve(null)),
  getCollections: mock(() => Promise.resolve([])),
  getCollection: mock(() => Promise.resolve(null)),
  createCollection: mock(() => Promise.resolve(null)),
  getSources: mock(() => Promise.resolve([])),
  getScheduledJobs: mock(() => Promise.resolve([])),
}));

// ---------------------------------------------------------------------------
// Import app (after mocks)
// ---------------------------------------------------------------------------

import app from "../../src/server/app.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeSampleItem(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    source: "cisa-kev",
    sourceId: "CVE-2024-9999",
    itemType: "vulnerability",
    url: "https://example.com/vuln",
    title: "Test Vulnerability",
    summary: "A test vulnerability.",
    content: "Full content",
    meta: null,
    topics: ["security"],
    publishedAt: new Date("2025-12-01T10:00:00Z").toISOString(),
    ingestedAt: new Date("2025-12-01T10:05:00Z").toISOString(),
    embedding: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: GET /api/items
// ---------------------------------------------------------------------------

describe("GET /api/items", () => {
  beforeEach(() => {
    mockGetRecentItems.mockClear();
    mockGetItem.mockClear();
  });

  it("returns { data: [], count: 0 } when no items exist", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    const res = await app.request("/api/items");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("passes source query param to getRecentItems", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    await app.request("/api/items?source=cisa-kev");

    expect(mockGetRecentItems).toHaveBeenCalledTimes(1);
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.source).toBe("cisa-kev");
  });

  it("passes type query param to getRecentItems", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    await app.request("/api/items?type=vulnerability");

    expect(mockGetRecentItems).toHaveBeenCalledTimes(1);
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.type).toBe("vulnerability");
  });

  it("passes limit and offset as integers to getRecentItems", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    await app.request("/api/items?limit=25&offset=10");

    expect(mockGetRecentItems).toHaveBeenCalledTimes(1);
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(25);
    expect(callArgs.offset).toBe(10);
  });

  it("defaults to limit=50 and offset=0 when not provided", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    await app.request("/api/items");

    expect(mockGetRecentItems).toHaveBeenCalledTimes(1);
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(50);
    expect(callArgs.offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/items/:id
// ---------------------------------------------------------------------------

describe("GET /api/items/:id", () => {
  beforeEach(() => {
    mockGetRecentItems.mockClear();
    mockGetItem.mockClear();
  });

  it("returns 404 with error message when item is not found", async () => {
    mockGetItem.mockResolvedValue(null);

    const res = await app.request(`/api/items/${VALID_UUID}`);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Item not found");
  });

  it("returns { data: item } when item exists", async () => {
    const sampleItem = makeSampleItem();
    mockGetItem.mockResolvedValue(sampleItem);

    const res = await app.request(`/api/items/${VALID_UUID}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeTruthy();
    expect(body.data.id).toBe(VALID_UUID);
    expect(body.data.title).toBe("Test Vulnerability");
  });
});
