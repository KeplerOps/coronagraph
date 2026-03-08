import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  ArxivCollector,
  extractArxivId,
  extractCategories,
  extractEntries,
  extractUrl,
  tag,
} from "../../../src/collectors/arxiv.ts";

// -- Helpers -----------------------------------------------------------------

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2501.12345v1</id>
    <title>Test Paper Title</title>
    <summary>This is a test summary for the paper.</summary>
    <published>2025-01-15T00:00:00Z</published>
    <link rel="alternate" href="http://arxiv.org/abs/2501.12345v1"/>
    <category term="cs.AI"/>
    <category term="cs.CR"/>
  </entry>
</feed>`;

describe("extractEntries", () => {
  it("parses entry blocks from XML", () => {
    const entries = extractEntries(sampleXml);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain("2501.12345v1");
    expect(entries[0]).toContain("Test Paper Title");
  });

  it("returns empty array when no entries exist", () => {
    const xml = `<feed></feed>`;
    expect(extractEntries(xml)).toEqual([]);
  });
});

describe("tag", () => {
  it("extracts tag content and collapses whitespace", () => {
    const xml = `<summary>  This   has   extra
    whitespace  </summary>`;
    expect(tag(xml, "summary")).toBe("This has extra whitespace");
  });

  it("returns undefined for missing tag", () => {
    expect(tag("<entry></entry>", "missing")).toBeUndefined();
  });
});

describe("extractArxivId", () => {
  it("strips version from a full URL", () => {
    expect(extractArxivId("http://arxiv.org/abs/2501.12345v1")).toBe(
      "2501.12345",
    );
  });

  it("strips version from a raw ID", () => {
    expect(extractArxivId("2501.12345v2")).toBe("2501.12345");
  });

  it("handles ID without version", () => {
    expect(extractArxivId("http://arxiv.org/abs/2501.12345")).toBe(
      "2501.12345",
    );
  });
});

describe("extractCategories", () => {
  it("collects category term attributes", () => {
    const entries = extractEntries(sampleXml);
    if (!entries[0]) throw new Error("Expected entry");
    const cats = extractCategories(entries[0]);
    expect(cats).toEqual(["cs.AI", "cs.CR"]);
  });

  it("returns empty array when no categories", () => {
    expect(extractCategories("<entry></entry>")).toEqual([]);
  });
});

describe("extractUrl", () => {
  it("finds alternate link", () => {
    const entries = extractEntries(sampleXml);
    if (!entries[0]) throw new Error("Expected entry");
    expect(extractUrl(entries[0])).toBe("http://arxiv.org/abs/2501.12345v1");
  });

  it("falls back to id tag", () => {
    const xml = `<id>http://arxiv.org/abs/2501.99999v1</id>`;
    expect(extractUrl(xml)).toBe("http://arxiv.org/abs/2501.99999v1");
  });
});

// -- Collector ---------------------------------------------------------------

describe("ArxivCollector.fetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("parses XML into RawItem[] with correct sourceId (no version)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(sampleXml, {
        status: 200,
        headers: { "Content-Type": "application/atom+xml" },
      }),
    );

    const collector = new ArxivCollector();
    const items = await collector.fetch();

    expect(items).toHaveLength(1);
    if (!items[0]) throw new Error("Expected item");
    const item = items[0];
    expect(item.sourceId).toBe("2501.12345");
    expect(item.itemType).toBe("paper");
    expect(item.title).toBe("Test Paper Title");
    expect(item.content).toBe("This is a test summary for the paper.");
    expect(item.url).toBe("http://arxiv.org/abs/2501.12345v1");
    expect(item.topics).toEqual(["cs.AI", "cs.CR"]);
    expect(item.publishedAt).toEqual(new Date("2025-01-15T00:00:00Z"));
  });

  it("returns empty array on API error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const collector = new ArxivCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });
});
