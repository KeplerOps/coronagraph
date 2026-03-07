import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
  parseDate,
  nvdUrl,
  CisaKevCollector,
} from "../../../src/collectors/cisa-kev.ts";

// -- Helpers -----------------------------------------------------------------

describe("parseDate", () => {
  it("parses YYYY-MM-DD to Date at midnight UTC", () => {
    const d = parseDate("2024-06-15");
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});

describe("nvdUrl", () => {
  it("constructs the correct NVD URL", () => {
    expect(nvdUrl("CVE-2024-1234")).toBe(
      "https://nvd.nist.gov/vuln/detail/CVE-2024-1234",
    );
  });
});

// -- Collector ---------------------------------------------------------------

describe("CisaKevCollector.fetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * Helper to produce a date string N days ago in YYYY-MM-DD format (UTC).
   */
  function daysAgo(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const recentDate = daysAgo(2);
  const oldDate = daysAgo(30);

  const kevResponse = {
    title: "CISA KEV",
    catalogVersion: "2024.01.15",
    dateReleased: recentDate,
    count: 2,
    vulnerabilities: [
      {
        cveID: "CVE-2024-9999",
        vendorProject: "TestVendor",
        product: "TestProduct",
        vulnerabilityName: "Recent Vuln",
        dateAdded: recentDate,
        shortDescription: "A recently added vulnerability",
        requiredAction: "Apply patch",
        dueDate: daysAgo(-7),
        knownRansomwareCampaignUse: "Known",
        notes: "",
      },
      {
        cveID: "CVE-2023-0001",
        vendorProject: "OldVendor",
        product: "OldProduct",
        vulnerabilityName: "Old Vuln",
        dateAdded: oldDate,
        shortDescription: "An old vulnerability",
        requiredAction: "Apply patch",
        dueDate: daysAgo(20),
        knownRansomwareCampaignUse: "Unknown",
        notes: "",
      },
    ],
  };

  it("filters out entries older than 7 days and keeps recent ones", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(kevResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collector = new CisaKevCollector();
    const items = await collector.fetch();

    expect(items).toHaveLength(1);
    expect(items[0]!.sourceId).toBe("CVE-2024-9999");
  });

  it("builds correct RawItem with meta fields", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(kevResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collector = new CisaKevCollector();
    const items = await collector.fetch();

    const item = items[0]!;
    expect(item.itemType).toBe("vulnerability");
    expect(item.title).toBe("CVE-2024-9999: Recent Vuln");
    expect(item.content).toBe("A recently added vulnerability");
    expect(item.url).toBe("https://nvd.nist.gov/vuln/detail/CVE-2024-9999");
    expect(item.topics).toContain("known-exploited");
    expect(item.topics).toContain("testvendor");
    expect((item.meta as any).vendor).toBe("TestVendor");
    expect((item.meta as any).product).toBe("TestProduct");
    expect((item.meta as any).knownRansomwareCampaignUse).toBe("Known");
  });

  it("returns empty array on API error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 }),
    );

    const collector = new CisaKevCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });
});
