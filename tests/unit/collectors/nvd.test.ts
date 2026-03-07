import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
  toNvdDate,
  extractCvss,
  extractCweIds,
  extractAffected,
  NvdCollector,
} from "../../../src/collectors/nvd.ts";

// -- Helpers -----------------------------------------------------------------

describe("toNvdDate", () => {
  it("converts a Date to ISO string without milliseconds", () => {
    const d = new Date("2024-06-15T08:30:45.123Z");
    const result = toNvdDate(d);
    expect(result).toBe("2024-06-15T08:30:45");
    expect(result).not.toContain(".");
    expect(result).not.toContain("Z");
  });
});

describe("extractCvss", () => {
  it("prefers V31 over V30 and V2", () => {
    const metrics = {
      cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: "CRITICAL" } }],
      cvssMetricV30: [{ cvssData: { baseScore: 7.5, baseSeverity: "HIGH" } }],
      cvssMetricV2: [{ cvssData: { baseScore: 5.0 } }],
    };
    const result = extractCvss(metrics);
    expect(result).toEqual({ score: 9.8, severity: "CRITICAL" });
  });

  it("falls back to V30 when V31 is absent", () => {
    const metrics = {
      cvssMetricV30: [{ cvssData: { baseScore: 7.5, baseSeverity: "HIGH" } }],
      cvssMetricV2: [{ cvssData: { baseScore: 5.0 } }],
    };
    const result = extractCvss(metrics);
    expect(result).toEqual({ score: 7.5, severity: "HIGH" });
  });

  it("returns undefined for empty metrics", () => {
    expect(extractCvss(undefined)).toBeUndefined();
    expect(extractCvss({})).toBeUndefined();
  });
});

describe("extractCweIds", () => {
  it("deduplicates CWE IDs and skips non-English descriptions", () => {
    const weaknesses = [
      {
        source: "nvd",
        type: "Primary",
        description: [
          { lang: "en", value: "CWE-79" },
          { lang: "en", value: "CWE-79" },
          { lang: "es", value: "CWE-80" },
        ],
      },
      {
        source: "other",
        type: "Secondary",
        description: [{ lang: "en", value: "CWE-89" }],
      },
    ];
    const result = extractCweIds(weaknesses);
    expect(result).toEqual(["CWE-79", "CWE-89"]);
  });

  it("returns empty array for undefined", () => {
    expect(extractCweIds(undefined)).toEqual([]);
  });
});

describe("extractAffected", () => {
  it("collects vulnerable CPE criteria and caps at 20", () => {
    // Build 25 vulnerable CPE matches to verify the cap
    const matches = Array.from({ length: 25 }, (_, i) => ({
      criteria: `cpe:2.3:a:vendor:product${i}:*`,
      vulnerable: true,
    }));
    const configurations = [{ nodes: [{ cpeMatch: matches }] }];
    const result = extractAffected(configurations);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe("cpe:2.3:a:vendor:product0:*");
  });

  it("skips non-vulnerable matches", () => {
    const configurations = [
      {
        nodes: [
          {
            cpeMatch: [
              { criteria: "cpe:2.3:a:vendor:vuln:*", vulnerable: true },
              { criteria: "cpe:2.3:a:vendor:safe:*", vulnerable: false },
            ],
          },
        ],
      },
    ];
    const result = extractAffected(configurations);
    expect(result).toEqual(["cpe:2.3:a:vendor:vuln:*"]);
  });

  it("returns empty array for undefined", () => {
    expect(extractAffected(undefined)).toEqual([]);
  });
});

// -- Collector ---------------------------------------------------------------

describe("NvdCollector.fetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const nvdResponse = {
    vulnerabilities: [
      {
        cve: {
          id: "CVE-2024-1234",
          published: "2024-01-15T10:00:00.000",
          lastModified: "2024-01-15T12:00:00.000",
          descriptions: [
            { lang: "en", value: "Test vulnerability description" },
          ],
          references: [{ url: "https://example.com/ref1" }],
          weaknesses: [
            {
              source: "nvd",
              type: "Primary",
              description: [{ lang: "en", value: "CWE-79" }],
            },
          ],
          metrics: {
            cvssMetricV31: [
              { cvssData: { baseScore: 9.8, baseSeverity: "CRITICAL" } },
            ],
          },
          configurations: [
            {
              nodes: [
                {
                  cpeMatch: [
                    {
                      criteria: "cpe:2.3:a:vendor:product:*",
                      vulnerable: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    totalResults: 1,
    resultsPerPage: 1,
  };

  it("returns mapped RawItem[] on successful fetch", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(nvdResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collector = new NvdCollector();
    const items = await collector.fetch();

    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.sourceId).toBe("CVE-2024-1234");
    expect(item.itemType).toBe("vulnerability");
    expect(item.title).toStartWith("CVE-2024-1234:");
    expect(item.content).toBe("Test vulnerability description");
    expect(item.url).toBe("https://example.com/ref1");
    expect(item.topics).toContain("cwe-79");
    expect(item.topics).toContain("cve");
    expect(item.topics).toContain("critical");
    expect(item.meta).toBeDefined();
    expect((item.meta as any).cvss.score).toBe(9.8);
    expect((item.meta as any).cwe).toEqual(["CWE-79"]);
    expect((item.meta as any).affected).toEqual([
      "cpe:2.3:a:vendor:product:*",
    ]);
  });

  it("returns empty array on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const collector = new NvdCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network failure"));

    const collector = new NvdCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });
});
