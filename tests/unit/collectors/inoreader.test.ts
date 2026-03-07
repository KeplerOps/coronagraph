import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";

// Mock config BEFORE importing the module under test
mock.module("../../../src/config.ts", () => ({
  getConfig: () => ({
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    PORT: 3000,
    INOREADER_APP_ID: "test-app-id",
    INOREADER_APP_KEY: "test-app-key",
    INOREADER_TOKEN: "test-token",
  }),
}));

import {
  extractTopics,
  InoreaderCollector,
  stripHtml,
} from "../../../src/collectors/inoreader.ts";

// -- Helpers -----------------------------------------------------------------

describe("stripHtml", () => {
  it("removes HTML tags, replaces entities, and collapses whitespace", () => {
    const html =
      '<p>Hello &amp; <b>world</b>!</p> <a href="#">Link &lt;here&gt;</a> &quot;test&quot;&nbsp;end';
    const result = stripHtml(html);
    expect(result).toBe('Hello & world ! Link <here> "test" end');
  });

  it("respects maxLen parameter", () => {
    const html = "<p>This is a long string that should be truncated</p>";
    const result = stripHtml(html, 10);
    expect(result).toHaveLength(10);
    expect(result).toBe("This is a ");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("extractTopics", () => {
  it("extracts labels from category strings", () => {
    const categories = [
      "user/1234567/label/Security",
      "user/1234567/state/com.google/reading-list",
      "user/1234567/label/AI News",
    ];
    const topics = extractTopics(categories);
    expect(topics).toEqual(["security", "ai news"]);
  });

  it("returns empty array for undefined", () => {
    expect(extractTopics(undefined)).toEqual([]);
  });

  it("returns empty array when no /label/ patterns exist", () => {
    const categories = [
      "user/1234567/state/com.google/reading-list",
      "user/1234567/state/com.google/starred",
    ];
    expect(extractTopics(categories)).toEqual([]);
  });
});

// -- Collector ---------------------------------------------------------------

describe("InoreaderCollector.fetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const inoreaderResponse = {
    items: [
      {
        id: "tag:google.com,2005:reader/item/00000000deadbeef",
        title: "Test Article Title",
        canonical: [{ href: "https://example.com/article" }],
        summary: {
          content: "<p>This is <b>HTML</b> content &amp; entities.</p>",
        },
        categories: [
          "user/1234567/label/Security",
          "user/1234567/state/com.google/reading-list",
        ],
        published: 1705312800, // 2024-01-15T10:00:00Z
        origin: {
          title: "Example Blog",
          htmlUrl: "https://example.com",
        },
      },
    ],
    continuation: "abc123",
  };

  it("returns mapped RawItem[] with stripped HTML content", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(inoreaderResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collector = new InoreaderCollector();
    const items = await collector.fetch();

    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.sourceId).toBe(
      "tag:google.com,2005:reader/item/00000000deadbeef",
    );
    expect(item.itemType).toBe("article");
    expect(item.title).toBe("Test Article Title");
    expect(item.url).toBe("https://example.com/article");
    // HTML should be stripped
    expect(item.content).not.toContain("<p>");
    expect(item.content).not.toContain("<b>");
    expect(item.content).toContain("HTML");
    expect(item.content).toContain("&");
    expect(item.topics).toEqual(["security"]);
    expect((item.meta as any).origin).toBe("Example Blog");
    expect((item.meta as any).originUrl).toBe("https://example.com");
    expect(item.publishedAt).toEqual(new Date(1705312800 * 1000));
  });

  it("returns empty array on API error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );

    const collector = new InoreaderCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });
});

describe("InoreaderCollector.fetch with missing credentials", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
    // Override config mock to return missing credentials
    mock.module("../../../src/config.ts", () => ({
      getConfig: () => ({
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        PORT: 3000,
        // No INOREADER_APP_ID, INOREADER_APP_KEY, or INOREADER_TOKEN
      }),
    }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    // Restore the working config for other tests
    mock.module("../../../src/config.ts", () => ({
      getConfig: () => ({
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        PORT: 3000,
        INOREADER_APP_ID: "test-app-id",
        INOREADER_APP_KEY: "test-app-key",
        INOREADER_TOKEN: "test-token",
      }),
    }));
  });

  it("returns empty array when INOREADER_APP_ID is missing", async () => {
    // Need to re-import to pick up the changed mock
    const { InoreaderCollector: FreshCollector } = await import(
      "../../../src/collectors/inoreader.ts"
    );
    const collector = new FreshCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
