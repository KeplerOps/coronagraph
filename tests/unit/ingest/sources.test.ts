// ---------------------------------------------------------------------------
// Tests for src/ingest/sources.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { Collector, RawItem, SourceMetadata } from "../../../src/collectors/base.ts";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockUpsertSource = mock(() =>
  Promise.resolve({
    id: "test",
    name: "Test",
    type: "api",
    config: null,
    enabled: true,
    lastFetched: null,
    fetchIntervalMinutes: 30,
  }),
);

mock.module("../../../src/db/queries.ts", () => ({
  upsertSource: mockUpsertSource,
}));

mock.module("../../../src/db/client.ts", () => ({
  db: {},
  client: {},
}));

// Import AFTER mocks are set up
const { registerSources } = await import("../../../src/ingest/sources.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollector(
  source: string,
  metadata?: Partial<SourceMetadata>,
): Collector {
  return {
    source,
    sourceMetadata: {
      id: source,
      name: metadata?.name ?? `Test ${source}`,
      type: metadata?.type ?? "api",
      url: metadata?.url ?? `https://${source}.example.com`,
      description: metadata?.description ?? `Test collector for ${source}`,
    },
    fetch: () => Promise.resolve([] as RawItem[]),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("registerSources", () => {
  beforeEach(() => {
    mockUpsertSource.mockClear();
    mockUpsertSource.mockImplementation(() =>
      Promise.resolve({
        id: "test",
        name: "Test",
        type: "api",
        config: null,
        enabled: true,
        lastFetched: null,
        fetchIntervalMinutes: 30,
      }),
    );
  });

  it("calls upsertSource for each collector", async () => {
    const collectors = [
      makeCollector("source-a"),
      makeCollector("source-b"),
      makeCollector("source-c"),
    ];

    await registerSources(collectors);

    expect(mockUpsertSource).toHaveBeenCalledTimes(3);
  });

  it("passes correct metadata to upsertSource", async () => {
    const collectors = [
      makeCollector("nvd", {
        name: "National Vulnerability Database",
        type: "api",
        url: "https://nvd.nist.gov",
        description: "NVD CVE feed",
      }),
    ];

    await registerSources(collectors);

    expect(mockUpsertSource).toHaveBeenCalledTimes(1);
    const call = mockUpsertSource.mock.calls[0][0] as {
      id: string;
      name: string;
      type: string;
      url: string;
      description: string;
    };
    expect(call.id).toBe("nvd");
    expect(call.name).toBe("National Vulnerability Database");
    expect(call.type).toBe("api");
    expect(call.url).toBe("https://nvd.nist.gov");
    expect(call.description).toBe("NVD CVE feed");
  });

  it("continues when a single upsert fails", async () => {
    let callCount = 0;
    mockUpsertSource.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error("DB error"));
      }
      return Promise.resolve({
        id: "test",
        name: "Test",
        type: "api",
        config: null,
        enabled: true,
        lastFetched: null,
        fetchIntervalMinutes: 30,
      });
    });

    const collectors = [
      makeCollector("source-a"),
      makeCollector("source-b"),
      makeCollector("source-c"),
    ];

    // Should not throw
    await registerSources(collectors);

    // All three should have been attempted
    expect(mockUpsertSource).toHaveBeenCalledTimes(3);
  });

  it("handles empty collector list", async () => {
    await registerSources([]);
    expect(mockUpsertSource).toHaveBeenCalledTimes(0);
  });
});
