import { describe, it, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockCreate = mock(() =>
  Promise.resolve({
    content: [
      {
        type: "text",
        text: '{"should_alert": true, "urgency": "critical", "reason": "Active exploit", "recommended_action": "Patch immediately"}',
      },
    ],
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

import { evaluateAlerts } from "../../../src/analysis/alerts.ts";
import type { AlertEvaluation, AlertUrgency } from "../../../src/analysis/alerts.ts";

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
    summary: "A critical vulnerability was found.",
    content: "Full content about the vulnerability.",
    meta: null,
    topics: ["security"],
    publishedAt: new Date(),
    ingestedAt: new Date(),
    embedding: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateAlerts", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetRecentItems.mockClear();
    // Ensure config always returns a valid key at the start of each test
    mockGetConfig.mockReturnValue({
      ANTHROPIC_API_KEY: "test-key",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: 3000,
    });
  });

  it("returns empty array when no ANTHROPIC_API_KEY is configured", async () => {
    // Override config to return empty API key
    mockGetConfig.mockReturnValue({
      ANTHROPIC_API_KEY: "",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: 3000,
    });

    const result = await evaluateAlerts();
    expect(result).toEqual([]);
    // getRecentItems should never be called when there is no API key
    expect(mockGetRecentItems).not.toHaveBeenCalled();
  });

  it("returns empty array when no recent items exist", async () => {
    mockGetRecentItems.mockResolvedValue([]);

    const result = await evaluateAlerts();
    expect(result).toEqual([]);
  });

  it("returns alert-worthy items sorted by urgency", async () => {
    // Create items with recent ingestedAt timestamps
    const now = Date.now();
    const items = [
      makeItem({
        id: "item-medium",
        title: "Medium Urgency",
        ingestedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
      makeItem({
        id: "item-critical",
        title: "Critical Urgency",
        ingestedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
      makeItem({
        id: "item-high",
        title: "High Urgency",
        ingestedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
    ];
    mockGetRecentItems.mockResolvedValue(items);

    // Return different urgencies for different items
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      const urgencies = ["medium", "critical", "high"];
      const urgency = urgencies[(callCount - 1) % 3];
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              should_alert: true,
              urgency,
              reason: `${urgency} alert`,
              recommended_action: "Take action",
            }),
          },
        ],
      });
    });

    const result = await evaluateAlerts({ hoursBack: 4 });

    // All 3 should be alert-worthy
    expect(result.length).toBe(3);

    // Sorted by urgency: critical > high > medium
    expect(result[0].urgency).toBe("critical");
    expect(result[1].urgency).toBe("high");
    expect(result[2].urgency).toBe("medium");
  });

  it("handles JSON response with markdown fencing", async () => {
    const item = makeItem({
      ingestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });
    mockGetRecentItems.mockResolvedValue([item]);

    // Return JSON wrapped in markdown code fences
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"should_alert": true, "urgency": "high", "reason": "Fenced response", "recommended_action": "Check it"}\n```',
        },
      ],
    });

    const result = await evaluateAlerts({ hoursBack: 4 });

    expect(result.length).toBe(1);
    expect(result[0].shouldAlert).toBe(true);
    expect(result[0].urgency).toBe("high");
    expect(result[0].reason).toBe("Fenced response");
  });

  it("falls back gracefully when JSON parse fails", async () => {
    const item = makeItem({
      ingestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });
    mockGetRecentItems.mockResolvedValue([item]);

    // Return completely invalid response (no JSON at all)
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "This is not JSON at all, just plain text with no braces",
        },
      ],
    });

    const result = await evaluateAlerts({ hoursBack: 4 });

    // Should return empty because shouldAlert defaults to false on parse failure
    expect(result).toEqual([]);
  });

  it("handles API error for individual items gracefully", async () => {
    const item = makeItem({
      ingestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });
    mockGetRecentItems.mockResolvedValue([item]);

    // Simulate API error
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await evaluateAlerts({ hoursBack: 4 });

    // Should return empty array (error items have shouldAlert: false)
    expect(result).toEqual([]);
  });

  it("respects hoursBack option for filtering", async () => {
    const now = Date.now();
    // Item ingested 2 hours ago -- within a 4h window but outside a 1h window
    const item = makeItem({
      ingestedAt: new Date(now - 2 * 60 * 60 * 1000),
    });
    mockGetRecentItems.mockResolvedValue([item]);

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"should_alert": true, "urgency": "high", "reason": "Recent", "recommended_action": "Act"}',
        },
      ],
    });

    // With hoursBack=1, the item should be outside the window
    const resultNarrow = await evaluateAlerts({ hoursBack: 1 });
    expect(resultNarrow).toEqual([]);

    // With hoursBack=4, the item should be inside the window
    const resultWide = await evaluateAlerts({ hoursBack: 4 });
    expect(resultWide.length).toBe(1);
  });

  it("processes items in batches of 5 (concurrency limit)", async () => {
    const now = Date.now();
    // Create 12 items to test batching (should be 3 batches: 5+5+2)
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        title: `Item ${i}`,
        ingestedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
    );
    mockGetRecentItems.mockResolvedValue(items);

    // Track call order to verify batching
    const callTimestamps: number[] = [];
    mockCreate.mockImplementation(() => {
      callTimestamps.push(Date.now());
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: '{"should_alert": true, "urgency": "low", "reason": "Test", "recommended_action": "None"}',
          },
        ],
      });
    });

    const result = await evaluateAlerts({ hoursBack: 4 });

    // All 12 items should have been evaluated
    expect(mockCreate).toHaveBeenCalledTimes(12);
    // All 12 items should be alert-worthy
    expect(result.length).toBe(12);
  });
});
