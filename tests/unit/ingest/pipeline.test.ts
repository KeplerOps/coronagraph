// ---------------------------------------------------------------------------
// Tests for src/ingest/pipeline.ts
//
// Instead of mocking summarizer.ts and embedder.ts directly (which would leak
// mock.module state to other test files in Bun), we mock their underlying
// dependencies: the Anthropic SDK and globalThis.fetch (for Voyage API).
// The insertItem DB call is mocked since it requires a database connection.
// ---------------------------------------------------------------------------

import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import type { Collector, RawItem } from "../../../src/collectors/base.ts";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockCreate = mock(() =>
  Promise.resolve({
    content: [
      {
        type: "text" as const,
        text: '{"summary": "AI summary", "topics": ["new-topic"]}',
      },
    ],
  }),
);

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const mockInsertItem = mock(() =>
  Promise.resolve({
    id: "test-id",
    source: "test-source",
    sourceId: "test-source-id",
    itemType: "article",
    url: "https://example.com",
    title: "Test Title",
    summary: "AI summary",
    content: "Test content",
    meta: null,
    topics: ["testing", "new-topic"],
    publishedAt: new Date(),
    ingestedAt: new Date(),
    embedding: null,
  }),
);

const defaultConfig = {
  ANTHROPIC_API_KEY: "test-key",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_TO: "test@example.com",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "test-chat-id",
  EMBEDDING_API_KEY: "test-embedding-key",
  EMBEDDING_MODEL: "voyage-3",
  EMBEDDING_DIMENSIONS: 1024,
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 3000,
};

let currentConfig = { ...defaultConfig };

mock.module("../../../src/config.ts", () => ({
  getConfig: () => currentConfig,
}));

mock.module("../../../src/db/queries.ts", () => ({
  insertItem: mockInsertItem,
}));

// Import AFTER mocks are set up
const { ingestFromCollector, ingestAll } = await import(
  "../../../src/ingest/pipeline.ts"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollector(source: string, items: RawItem[]): Collector {
  return {
    source,
    sourceMetadata: {
      id: source,
      name: `Test ${source}`,
      type: "api",
      description: `Test collector for ${source}`,
    },
    fetch: mock(() => Promise.resolve(items)),
  };
}

function makeRawItem(overrides?: Partial<RawItem>): RawItem {
  return {
    sourceId: "item-001",
    itemType: "article",
    url: "https://example.com/item",
    title: "Test Item",
    content: "Some test content here.",
    meta: {},
    topics: ["existing-topic"],
    publishedAt: new Date("2025-01-15T12:00:00Z"),
    ...overrides,
  };
}

/** Create a mock fetch that returns a Voyage embedding response */
function makeVoyageFetchResponse() {
  return new Response(
    JSON.stringify({
      object: "list",
      data: [
        { object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] },
      ],
      model: "voyage-3",
      usage: { total_tokens: 10 },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("pipeline", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockCreate.mockClear();
    mockInsertItem.mockClear();
    currentConfig = { ...defaultConfig };

    // Restore default implementations
    mockCreate.mockImplementation(() =>
      Promise.resolve({
        content: [
          {
            type: "text" as const,
            text: '{"summary": "AI summary", "topics": ["new-topic"]}',
          },
        ],
      }),
    );
    mockInsertItem.mockImplementation(() =>
      Promise.resolve({
        id: "test-id",
        source: "test-source",
        sourceId: "test-source-id",
        itemType: "article",
        url: "https://example.com",
        title: "Test Title",
        summary: "AI summary",
        content: "Test content",
        meta: null,
        topics: ["testing", "new-topic"],
        publishedAt: new Date(),
        ingestedAt: new Date(),
        embedding: null,
      }),
    );

    // Mock fetch for Voyage API (embedder uses fetch)
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(makeVoyageFetchResponse()),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Basic ingestion counts
  // -----------------------------------------------------------------------

  it("ingestFromCollector returns correct counts", async () => {
    const items = [makeRawItem(), makeRawItem({ sourceId: "item-002" })];
    const collector = makeCollector("test-source", items);

    const result = await ingestFromCollector(collector);

    expect(result.source).toBe("test-source");
    expect(result.fetched).toBe(2);
    expect(result.ingested).toBe(2);
    expect(result.errors).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Topic merging / deduplication
  // -----------------------------------------------------------------------

  it("merges LLM topics with raw topics via deduplication", async () => {
    mockCreate.mockImplementation(() =>
      Promise.resolve({
        content: [
          {
            type: "text" as const,
            text: '{"summary": "AI summary", "topics": ["existing-topic", "new-topic", "another-topic"]}',
          },
        ],
      }),
    );

    const items = [makeRawItem({ topics: ["existing-topic"] })];
    const collector = makeCollector("test-source", items);

    await ingestFromCollector(collector);

    expect(mockInsertItem).toHaveBeenCalledTimes(1);
    const insertedItem = mockInsertItem.mock.calls[0][0] as {
      topics: string[];
    };
    // Should be deduplicated: "existing-topic" appears in both raw and LLM
    const uniqueTopics = [...new Set(insertedItem.topics)];
    expect(insertedItem.topics.length).toBe(uniqueTopics.length);
    expect(insertedItem.topics).toContain("existing-topic");
    expect(insertedItem.topics).toContain("new-topic");
    expect(insertedItem.topics).toContain("another-topic");
  });

  // -----------------------------------------------------------------------
  // Fallback when summarize returns null
  // -----------------------------------------------------------------------

  it("falls back to content truncation when summarize returns null", async () => {
    // Make the Anthropic API throw, so summarize returns null
    mockCreate.mockImplementation(() =>
      Promise.reject(new Error("API unavailable")),
    );

    const content = "A".repeat(300);
    const items = [makeRawItem({ content, topics: ["original"] })];
    const collector = makeCollector("test-source", items);

    await ingestFromCollector(collector);

    expect(mockInsertItem).toHaveBeenCalledTimes(1);
    const insertedItem = mockInsertItem.mock.calls[0][0] as {
      summary: string;
      topics: string[];
    };
    // Pipeline falls back to content.slice(0, 200) when summarize returns null
    expect(insertedItem.summary).toBe("A".repeat(200));
    expect(insertedItem.topics).toEqual(["original"]);
  });

  // -----------------------------------------------------------------------
  // Embed returning null
  // -----------------------------------------------------------------------

  it("handles embed returning null and stores without embedding", async () => {
    // Make Voyage API fail, so embed returns null
    fetchSpy.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const items = [makeRawItem()];
    const collector = makeCollector("test-source", items);

    await ingestFromCollector(collector);

    expect(mockInsertItem).toHaveBeenCalledTimes(1);
    const insertedItem = mockInsertItem.mock.calls[0][0] as {
      embedding: number[] | undefined;
    };
    expect(insertedItem.embedding).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Error counting
  // -----------------------------------------------------------------------

  it("counts errors when processItem throws", async () => {
    // Make insertItem throw on first call, succeed on second
    let callCount = 0;
    mockInsertItem.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("DB connection lost"));
      }
      return Promise.resolve({
        id: "test-id",
        source: "test-source",
        sourceId: "item-002",
        itemType: "article",
        url: "https://example.com",
        title: "Test Title",
        summary: "AI summary",
        content: "Test content",
        meta: null,
        topics: [],
        publishedAt: new Date(),
        ingestedAt: new Date(),
        embedding: null,
      });
    });

    const items = [
      makeRawItem({ sourceId: "item-001" }),
      makeRawItem({ sourceId: "item-002" }),
    ];
    const collector = makeCollector("test-source", items);

    const result = await ingestFromCollector(collector);

    expect(result.fetched).toBe(2);
    expect(result.ingested).toBe(1);
    expect(result.errors).toBe(1);
  });

  // -----------------------------------------------------------------------
  // ingestAll with multiple collectors
  // -----------------------------------------------------------------------

  it("ingestAll runs multiple collectors and returns results array", async () => {
    const collector1 = makeCollector("source-a", [
      makeRawItem({ sourceId: "a1" }),
    ]);
    const collector2 = makeCollector("source-b", [
      makeRawItem({ sourceId: "b1" }),
      makeRawItem({ sourceId: "b2" }),
    ]);

    const results = await ingestAll([collector1, collector2]);

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe("source-a");
    expect(results[0].fetched).toBe(1);
    expect(results[0].ingested).toBe(1);
    expect(results[1].source).toBe("source-b");
    expect(results[1].fetched).toBe(2);
    expect(results[1].ingested).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Source is set from collector.source
  // -----------------------------------------------------------------------

  it("source is set from collector.source, not from raw item", async () => {
    const items = [makeRawItem()];
    const collector = makeCollector("my-custom-source", items);

    await ingestFromCollector(collector);

    expect(mockInsertItem).toHaveBeenCalledTimes(1);
    const insertedItem = mockInsertItem.mock.calls[0][0] as {
      source: string;
    };
    expect(insertedItem.source).toBe("my-custom-source");
  });
});
