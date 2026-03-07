import { describe, expect, it, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing app
// ---------------------------------------------------------------------------

mock.module("../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

mock.module("../../src/db/queries.ts", () => ({
  getRecentItems: mock(() => Promise.resolve([])),
  getItem: mock(() => Promise.resolve(null)),
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
// Tests
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  it("returns 200 with { status: 'ok', timestamp: '...' }", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns a valid ISO 8601 timestamp", async () => {
    const res = await app.request("/health");
    const body = await res.json();

    // Parse the timestamp and verify it is a valid date
    const parsed = new Date(body.timestamp);
    expect(parsed.toString()).not.toBe("Invalid Date");

    // Verify it matches ISO 8601 format (ends with Z or timezone offset)
    expect(body.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });
});
