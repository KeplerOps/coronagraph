import type { Item } from "../../src/db/schema.ts";
import type { RawItem } from "../../src/collectors/base.ts";

let counter = 0;

/**
 * Create a fully-populated Item with sensible defaults.
 * Every call increments a counter to ensure unique IDs by default.
 */
export function makeItem(overrides?: Partial<Item>): Item {
  counter += 1;
  return {
    id: `00000000-0000-4000-a000-${String(counter).padStart(12, "0")}`,
    source: "nvd",
    sourceId: `CVE-2025-${String(counter).padStart(4, "0")}`,
    itemType: "vulnerability",
    url: `https://nvd.nist.gov/vuln/detail/CVE-2025-${String(counter).padStart(4, "0")}`,
    title: `Test Vulnerability ${counter}`,
    summary: `A test vulnerability summary for item ${counter}.`,
    content: `Detailed content about test vulnerability ${counter}.`,
    meta: { cvss: 7.5, severity: "HIGH" },
    topics: ["security", "testing"],
    publishedAt: new Date("2025-01-15T12:00:00Z"),
    ingestedAt: new Date("2025-01-15T12:30:00Z"),
    embedding: null,
    ...overrides,
  };
}

/**
 * Create a RawItem with sensible defaults for collector testing.
 */
export function makeRawItem(overrides?: Partial<RawItem>): RawItem {
  counter += 1;
  return {
    sourceId: `raw-${String(counter).padStart(6, "0")}`,
    itemType: "vulnerability",
    url: `https://example.com/item/${counter}`,
    title: `Test Raw Item ${counter}`,
    content: `Raw content for item ${counter}.`,
    meta: {},
    topics: ["testing"],
    publishedAt: new Date("2025-01-15T12:00:00Z"),
    ...overrides,
  };
}

/**
 * Reset the internal counter. Call in beforeEach/afterEach if you need
 * deterministic IDs across tests.
 */
export function resetItemCounter(): void {
  counter = 0;
}
