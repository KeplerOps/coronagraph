import { describe, it, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing app
// ---------------------------------------------------------------------------

const mockAddAnnotation = mock(() => Promise.resolve(null));
const mockGetItem = mock(() =>
  Promise.resolve({
    id: "test-id",
    source: "nvd",
    sourceId: "CVE-2024-0001",
    itemType: "vulnerability",
    url: "https://example.com",
    title: "Test Item",
    summary: "Test summary",
    content: "Test content",
    meta: null,
    topics: [],
    publishedAt: new Date().toISOString(),
    ingestedAt: new Date().toISOString(),
    embedding: null,
    annotations: [],
  }),
);
const mockCreateCollection = mock(() => Promise.resolve(null));
const mockGetCollections = mock(() => Promise.resolve([]));

mock.module("../../../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

mock.module("../../../../src/db/queries.ts", () => ({
  getRecentItems: mock(() => Promise.resolve([])),
  getItem: mockGetItem,
  searchItems: mock(() => Promise.resolve([])),
  addAnnotation: mockAddAnnotation,
}));

mock.module("../../../../src/db/queries-web.ts", () => ({
  getRecentBriefs: mock(() => Promise.resolve([])),
  getBrief: mock(() => Promise.resolve(null)),
  getCollections: mockGetCollections,
  getCollection: mock(() => Promise.resolve(null)),
  createCollection: mockCreateCollection,
  getSources: mock(() => Promise.resolve([])),
  getScheduledJobs: mock(() => Promise.resolve([])),
}));

// No API_KEY set: auth is disabled, CSRF still active
mock.module("../../../../src/config.ts", () => ({
  getConfig: () => ({
    DATABASE_URL: "postgresql://localhost/test",
    PORT: 3000,
    EMBEDDING_MODEL: "voyage-3",
    EMBEDDING_DIMENSIONS: 1024,
    API_KEY: undefined,
  }),
}));

// ---------------------------------------------------------------------------
// Import app (after mocks)
// ---------------------------------------------------------------------------

import app from "../../../../src/server/app.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Makes a GET request to get the CSRF token from the cookie.
 */
async function getCsrfToken(): Promise<string> {
  const res = await app.request("/health");
  const setCookie = res.headers.get("Set-Cookie") || "";
  const match = setCookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : "";
}

function postForm(
  path: string,
  body: Record<string, string>,
  csrfCookie?: string,
) {
  const formBody = new URLSearchParams(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (csrfCookie) {
    headers["Cookie"] = `csrf_token=${csrfCookie}`;
  }
  return app.request(path, {
    method: "POST",
    headers,
    body: formBody.toString(),
  });
}

// ---------------------------------------------------------------------------
// Tests: CSRF Protection
// ---------------------------------------------------------------------------

describe("CSRF protection", () => {
  beforeEach(() => {
    mockAddAnnotation.mockClear();
    mockGetItem.mockClear();
    mockCreateCollection.mockClear();
    mockGetCollections.mockClear();
  });

  describe("POST /items/:id/annotations", () => {
    it("rejects POST without CSRF token", async () => {
      const res = await postForm("/items/test-id/annotations", {
        note: "Test annotation",
      });
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toContain("CSRF");
    });

    it("rejects POST with mismatched CSRF token", async () => {
      const token = await getCsrfToken();
      const res = await postForm(
        "/items/test-id/annotations",
        { note: "Test annotation", _csrf: "wrong-token" },
        token,
      );
      expect(res.status).toBe(403);
    });

    it("allows POST with valid CSRF token", async () => {
      const token = await getCsrfToken();
      mockGetItem.mockResolvedValue({
        id: "test-id",
        source: "nvd",
        sourceId: "CVE-2024-0001",
        itemType: "vulnerability",
        url: "https://example.com",
        title: "Test Item",
        summary: "Test summary",
        content: "Test content",
        meta: null,
        topics: [],
        publishedAt: new Date().toISOString(),
        ingestedAt: new Date().toISOString(),
        embedding: null,
        annotations: [],
      });

      const res = await postForm(
        "/items/test-id/annotations",
        { note: "Test annotation", _csrf: token },
        token,
      );
      expect(res.status).toBe(200);
      expect(mockAddAnnotation).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /collections", () => {
    it("rejects POST without CSRF token", async () => {
      const res = await postForm("/collections", {
        name: "Test Collection",
      });
      expect(res.status).toBe(403);
    });

    it("rejects POST with mismatched CSRF token", async () => {
      const token = await getCsrfToken();
      const res = await postForm(
        "/collections",
        { name: "Test Collection", _csrf: "wrong-token" },
        token,
      );
      expect(res.status).toBe(403);
    });

    it("allows POST with valid CSRF token", async () => {
      const token = await getCsrfToken();
      mockGetCollections.mockResolvedValue([]);

      const res = await postForm(
        "/collections",
        { name: "Test Collection", _csrf: token },
        token,
      );
      expect(res.status).toBe(200);
      expect(mockCreateCollection).toHaveBeenCalledTimes(1);
    });
  });

  describe("CSRF token cookie", () => {
    it("sets csrf_token cookie on first request", async () => {
      const res = await app.request("/health");
      const setCookie = res.headers.get("Set-Cookie") || "";
      expect(setCookie).toContain("csrf_token=");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Strict");
    });

    it("generates a hex string token", async () => {
      const token = await getCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
