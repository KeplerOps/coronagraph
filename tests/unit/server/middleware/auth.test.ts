import { describe, it, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing app
// ---------------------------------------------------------------------------

const mockGetRecentItems = mock(() => Promise.resolve([]));
const mockGetItem = mock(() => Promise.resolve(null));

mock.module("../../../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

mock.module("../../../../src/db/queries.ts", () => ({
  getRecentItems: mockGetRecentItems,
  getItem: mockGetItem,
  searchItems: mock(() => Promise.resolve([])),
  addAnnotation: mock(() => Promise.resolve(null)),
}));

mock.module("../../../../src/db/queries-web.ts", () => ({
  getRecentBriefs: mock(() => Promise.resolve([])),
  getBrief: mock(() => Promise.resolve(null)),
  getCollections: mock(() => Promise.resolve([])),
  getCollection: mock(() => Promise.resolve(null)),
  createCollection: mock(() => Promise.resolve(null)),
  getSources: mock(() => Promise.resolve([])),
  getScheduledJobs: mock(() => Promise.resolve([])),
}));

// Mock config to control API_KEY
let mockApiKey: string | undefined = undefined;
mock.module("../../../../src/config.ts", () => ({
  getConfig: () => ({
    DATABASE_URL: "postgresql://localhost/test",
    PORT: 3000,
    EMBEDDING_MODEL: "voyage-3",
    EMBEDDING_DIMENSIONS: 1024,
    API_KEY: mockApiKey,
  }),
}));

// ---------------------------------------------------------------------------
// Import app (after mocks)
// ---------------------------------------------------------------------------

import app from "../../../../src/server/app.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reqWithBearer(path: string, token: string) {
  return app.request(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function reqWithCookie(path: string, cookie: string) {
  return app.request(path, {
    headers: { Cookie: cookie },
  });
}

// ---------------------------------------------------------------------------
// Tests: API Key Auth
// ---------------------------------------------------------------------------

describe("API authentication", () => {
  beforeEach(() => {
    mockGetRecentItems.mockClear();
    mockGetItem.mockClear();
  });

  describe("when API_KEY is not configured (graceful degradation)", () => {
    beforeEach(() => {
      mockApiKey = undefined;
    });

    it("allows unauthenticated access to /api/items", async () => {
      mockGetRecentItems.mockResolvedValue([]);
      const res = await app.request("/api/items");
      expect(res.status).toBe(200);
    });

    it("allows unauthenticated access to /api/items/:id", async () => {
      mockGetItem.mockResolvedValue(null);
      const res = await app.request("/api/items/test-id");
      expect(res.status).toBe(404); // 404 because item not found, but auth passed
    });

    it("health endpoint remains accessible", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
    });
  });

  describe("when API_KEY is configured", () => {
    beforeEach(() => {
      mockApiKey = "test-secret-key-123";
    });

    it("rejects /api/items without Authorization header", async () => {
      const res = await app.request("/api/items");
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects /api/items with wrong Bearer token", async () => {
      const res = await reqWithBearer("/api/items", "wrong-key");
      expect(res.status).toBe(401);
    });

    it("rejects /api/items with non-Bearer auth", async () => {
      const res = await app.request("/api/items", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(res.status).toBe(401);
    });

    it("allows /api/items with correct Bearer token", async () => {
      mockGetRecentItems.mockResolvedValue([]);
      const res = await reqWithBearer("/api/items", "test-secret-key-123");
      expect(res.status).toBe(200);
    });

    it("allows /api/items/:id with correct Bearer token", async () => {
      mockGetItem.mockResolvedValue(null);
      const res = await reqWithBearer(
        "/api/items/test-id",
        "test-secret-key-123",
      );
      expect(res.status).toBe(404); // auth passed, item not found
    });

    it("health endpoint remains unauthenticated", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Web Dashboard Auth
// ---------------------------------------------------------------------------

describe("Web dashboard authentication", () => {
  describe("when API_KEY is not configured", () => {
    beforeEach(() => {
      mockApiKey = undefined;
    });

    it("allows unauthenticated access to /", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    });

    it("allows unauthenticated access to /collections", async () => {
      const res = await app.request("/collections");
      expect(res.status).toBe(200);
    });
  });

  describe("when API_KEY is configured", () => {
    beforeEach(() => {
      mockApiKey = "test-secret-key-123";
    });

    it("redirects / to /login without auth cookie", async () => {
      const res = await app.request("/", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("redirects /collections to /login without auth cookie", async () => {
      const res = await app.request("/collections", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("allows access to / with valid auth cookie", async () => {
      const res = await reqWithCookie("/", "auth=test-secret-key-123");
      expect(res.status).toBe(200);
    });

    it("redirects to /login with invalid auth cookie", async () => {
      const res = await reqWithCookie("/", "auth=wrong-key");
      expect(res.status).toBe(302);
    });

    it("login page is accessible without auth", async () => {
      const res = await app.request("/login");
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Login Flow
// ---------------------------------------------------------------------------

describe("Login flow", () => {
  beforeEach(() => {
    mockApiKey = "test-secret-key-123";
  });

  it("GET /login renders login page", async () => {
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("API Key");
    expect(text).toContain("Sign In");
  });

  it("POST /login with correct key sets auth cookie and redirects", async () => {
    const formBody = new URLSearchParams({ api_key: "test-secret-key-123" });
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("auth=");
  });

  it("POST /login with wrong key returns 401", async () => {
    const formBody = new URLSearchParams({ api_key: "wrong-key" });
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Invalid API key");
  });

  it("GET /logout clears auth cookie and redirects to /login", async () => {
    const res = await app.request("/logout", {
      headers: { Cookie: "auth=test-secret-key-123" },
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });
});
