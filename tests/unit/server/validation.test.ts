import { beforeEach, describe, expect, it, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing app
// ---------------------------------------------------------------------------

const mockGetRecentItems = mock(() => Promise.resolve([]));
const mockGetItem = mock(() => Promise.resolve(null));
const mockGetBrief = mock(() => Promise.resolve(null));
const mockGetCollection = mock(() => Promise.resolve(null));

mock.module("../../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

mock.module("../../../src/db/queries.ts", () => ({
  getRecentItems: mockGetRecentItems,
  getItem: mockGetItem,
  searchItems: mock(() => Promise.resolve([])),
  addAnnotation: mock(() => Promise.resolve(null)),
}));

mock.module("../../../src/db/queries-web.ts", () => ({
  getRecentBriefs: mock(() => Promise.resolve([])),
  getBrief: mockGetBrief,
  getCollections: mock(() => Promise.resolve([])),
  getCollection: mockGetCollection,
  createCollection: mock(() => Promise.resolve(null)),
  getSources: mock(() => Promise.resolve([])),
  getScheduledJobs: mock(() => Promise.resolve([])),
}));

// ---------------------------------------------------------------------------
// Import app (after mocks)
// ---------------------------------------------------------------------------

import app from "../../../src/server/app.ts";

// ---------------------------------------------------------------------------
// Tests: UUID validation on :id params
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const INVALID_IDS = [
  "not-a-uuid",
  "12345",
  "'; DROP TABLE items; --",
  "a1b2c3d4-e5f6-7890-abcd-ef123456789", // too short
  "a1b2c3d4-e5f6-7890-abcd-ef12345678901", // too long
  "g1b2c3d4-e5f6-7890-abcd-ef1234567890", // invalid hex char
];

describe("UUID validation", () => {
  describe("GET /api/items/:id", () => {
    it("returns 400 for invalid UUID", async () => {
      for (const id of INVALID_IDS) {
        if (!id) continue; // skip empty string (route won't match)
        const res = await app.request(`/api/items/${id}`);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Invalid item ID");
      }
    });

    it("accepts a valid UUID", async () => {
      mockGetItem.mockResolvedValue(null);
      const res = await app.request(`/api/items/${VALID_UUID}`);
      // Should be 404 (not found), not 400 (invalid)
      expect(res.status).toBe(404);
    });
  });

  describe("GET /items/:id (web route)", () => {
    it("returns 400 for invalid UUID", async () => {
      const res = await app.request("/items/not-a-uuid");
      expect(res.status).toBe(400);
    });

    it("accepts a valid UUID", async () => {
      mockGetItem.mockResolvedValue(null);
      const res = await app.request(`/items/${VALID_UUID}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /items/:id/annotations (web route)", () => {
    it("returns 400 for invalid UUID", async () => {
      const res = await app.request(`/items/not-a-uuid/annotations`, {
        method: "POST",
        body: new URLSearchParams({ note: "test" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /briefs/:id (web route)", () => {
    it("returns 400 for invalid UUID", async () => {
      const res = await app.request("/briefs/not-a-uuid");
      expect(res.status).toBe(400);
    });

    it("accepts a valid UUID", async () => {
      mockGetBrief.mockResolvedValue(null);
      const res = await app.request(`/briefs/${VALID_UUID}`);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /collections/:id (web route)", () => {
    it("returns 400 for invalid UUID", async () => {
      const res = await app.request("/collections/not-a-uuid");
      expect(res.status).toBe(400);
    });

    it("accepts a valid UUID", async () => {
      mockGetCollection.mockResolvedValue(null);
      const res = await app.request(`/collections/${VALID_UUID}`);
      expect(res.status).toBe(404);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: limit/offset validation and capping
// ---------------------------------------------------------------------------

describe("limit/offset validation", () => {
  beforeEach(() => {
    mockGetRecentItems.mockClear();
    mockGetRecentItems.mockResolvedValue([]);
  });

  it("caps limit to 200", async () => {
    await app.request("/api/items?limit=999");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(200);
  });

  it("defaults limit to 50 for NaN input", async () => {
    await app.request("/api/items?limit=abc");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(50);
  });

  it("clamps negative limit to 0", async () => {
    await app.request("/api/items?limit=-10");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(0);
  });

  it("defaults offset to 0 for NaN input", async () => {
    await app.request("/api/items?offset=abc");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.offset).toBe(0);
  });

  it("clamps negative offset to 0", async () => {
    await app.request("/api/items?offset=-5");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.offset).toBe(0);
  });

  it("accepts valid limit and offset", async () => {
    await app.request("/api/items?limit=100&offset=50");
    const callArgs = mockGetRecentItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(100);
    expect(callArgs.offset).toBe(50);
  });
});
