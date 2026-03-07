import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockCreate = mock(() =>
  Promise.resolve({
    content: [{ type: "text", text: "Generated brief content here" }],
  }),
);

mock.module("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

const mockGetRecentItems = mock(() => Promise.resolve([]));
mock.module("../../../src/db/queries.ts", () => ({
  getRecentItems: mockGetRecentItems,
}));

const mockInsert = mock(() => ({
  values: mock(() => ({
    returning: mock(() => [{ id: "brief-1" }]),
  })),
}));
mock.module("../../../src/db/client.ts", () => ({
  db: { insert: mockInsert },
}));

mock.module("../../../src/db/schema.ts", () => ({
  briefs: {},
}));

const mockGetConfig = mock(() => ({
  ANTHROPIC_API_KEY: "test-key",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 3000,
}));

mock.module("../../../src/config.ts", () => ({
  getConfig: mockGetConfig,
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import {
  formatItemsForPrompt,
  generateMorningBrief,
  generateWeeklyDigest,
} from "../../../src/analysis/briefing.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    source: "cisa-kev",
    sourceId: "CVE-2024-1234",
    itemType: "vulnerability",
    url: "https://example.com/vuln",
    title: "Critical Vulnerability in Widget",
    summary: "A critical vulnerability was found in Widget v3.",
    content: "Full content here...",
    meta: null,
    topics: ["security"],
    publishedAt: new Date("2025-12-01T10:00:00Z"),
    ingestedAt: new Date("2025-12-01T10:05:00Z"),
    embedding: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: formatItemsForPrompt
// ---------------------------------------------------------------------------

describe("formatItemsForPrompt", () => {
  it("formats a single item with all fields", () => {
    const item = makeItem();
    const result = formatItemsForPrompt([item]);

    expect(result).toContain("[1] Critical Vulnerability in Widget");
    expect(result).toContain("Source: cisa-kev | Type: vulnerability");
    expect(result).toContain(
      "Summary: A critical vulnerability was found in Widget v3.",
    );
    expect(result).toContain("URL: https://example.com/vuln");
    expect(result).toContain("Published: 2025-12-01T10:00:00.000Z");
  });

  it("shows 'No summary' when summary is null", () => {
    const item = makeItem({ summary: null });
    const result = formatItemsForPrompt([item]);

    expect(result).toContain("Summary: No summary");
  });

  it("shows 'N/A' when url is null", () => {
    const item = makeItem({ url: null });
    const result = formatItemsForPrompt([item]);

    expect(result).toContain("URL: N/A");
  });

  it("shows 'Unknown' when publishedAt is null", () => {
    const item = makeItem({ publishedAt: null });
    const result = formatItemsForPrompt([item]);

    expect(result).toContain("Published: Unknown");
  });

  it("numbers items starting from 1", () => {
    const items = [
      makeItem({ id: "item-1", title: "First Item" }),
      makeItem({ id: "item-2", title: "Second Item" }),
      makeItem({ id: "item-3", title: "Third Item" }),
    ];
    const result = formatItemsForPrompt(items);

    expect(result).toContain("[1] First Item");
    expect(result).toContain("[2] Second Item");
    expect(result).toContain("[3] Third Item");
    // Should NOT contain a [0] index
    expect(result).not.toContain("[0]");
  });
});

// ---------------------------------------------------------------------------
// Tests: generateMorningBrief
// ---------------------------------------------------------------------------

describe("generateMorningBrief", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetRecentItems.mockClear();
    mockInsert.mockClear();
    // Ensure config always returns a valid key at the start of each test
    mockGetConfig.mockReturnValue({
      ANTHROPIC_API_KEY: "test-key",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: 3000,
    });
  });

  it("returns null when no ANTHROPIC_API_KEY is configured", async () => {
    // Override config to return empty API key
    mockGetConfig.mockReturnValue({
      ANTHROPIC_API_KEY: "",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: 3000,
    });

    const result = await generateMorningBrief();
    expect(result).toBeNull();
    // getRecentItems should never be called when there is no API key
    expect(mockGetRecentItems).not.toHaveBeenCalled();
  });

  it("returns null when no recent items exist in the last 24 hours", async () => {
    // Return items that are old (outside the 24-hour window)
    const oldItem = makeItem({
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
    });
    mockGetRecentItems.mockResolvedValue([oldItem]);

    const result = await generateMorningBrief();
    expect(result).toBeNull();
  });

  it("returns BriefResult with title, content, itemIds, and briefId on success", async () => {
    const recentItem = makeItem({
      id: "recent-item-1",
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });
    mockGetRecentItems.mockResolvedValue([recentItem]);
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Morning brief content" }],
    });

    const result = await generateMorningBrief();

    expect(result).not.toBeNull();
    expect(result!.title).toContain("Morning Brief");
    expect(result!.content).toBe("Morning brief content");
    expect(result!.itemIds).toEqual(["recent-item-1"]);
    expect(result!.briefId).toBe("brief-1");
  });

  it("includes weekday and date in the title", async () => {
    const recentItem = makeItem({
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });
    mockGetRecentItems.mockResolvedValue([recentItem]);
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "content" }],
    });

    const result = await generateMorningBrief();

    expect(result).not.toBeNull();
    // Title format: "Morning Brief - Monday, January 1, 2025"
    // It should contain a weekday name
    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const containsWeekday = weekdays.some((day) =>
      result!.title.includes(day),
    );
    expect(containsWeekday).toBe(true);

    // It should contain a year
    const currentYear = new Date().getFullYear().toString();
    expect(result!.title).toContain(currentYear);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateWeeklyDigest
// ---------------------------------------------------------------------------

describe("generateWeeklyDigest", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetRecentItems.mockClear();
    mockInsert.mockClear();
    mockGetConfig.mockReturnValue({
      ANTHROPIC_API_KEY: "test-key",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: 3000,
    });
  });

  it("returns null when no items exist in the last 7 days", async () => {
    // Return items that are older than 7 days
    const oldItem = makeItem({
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    });
    mockGetRecentItems.mockResolvedValue([oldItem]);

    const result = await generateWeeklyDigest();
    expect(result).toBeNull();
  });
});
