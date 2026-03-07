import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  deriveTopics,
  GithubAdvisoriesCollector,
} from "../../../src/collectors/github-advisories.ts";

// -- Helpers -----------------------------------------------------------------

describe("deriveTopics", () => {
  it("returns lowercase CWE IDs plus severity when CWEs are present", () => {
    const advisory = {
      ghsa_id: "GHSA-xxxx",
      cve_id: "CVE-2024-1234",
      summary: "Test",
      description: null,
      severity: "high",
      html_url: "https://github.com/advisories/GHSA-xxxx",
      published_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
      cvss: null,
      cwes: [
        { cwe_id: "CWE-79", name: "XSS" },
        { cwe_id: "CWE-89", name: "SQL Injection" },
      ],
      identifiers: null,
      type: "reviewed",
    };
    const topics = deriveTopics(advisory as any);
    expect(topics).toEqual(["cwe-79", "cwe-89", "high"]);
  });

  it("returns just severity when CWEs are absent", () => {
    const advisory = {
      ghsa_id: "GHSA-yyyy",
      cve_id: null,
      summary: "Test",
      description: null,
      severity: "critical",
      html_url: "https://github.com/advisories/GHSA-yyyy",
      published_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
      cvss: null,
      cwes: null,
      identifiers: null,
      type: "reviewed",
    };
    const topics = deriveTopics(advisory as any);
    expect(topics).toEqual(["critical"]);
  });

  it("returns empty array when cwes is null and severity is empty", () => {
    const advisory = {
      ghsa_id: "GHSA-zzzz",
      cve_id: null,
      summary: "Test",
      description: null,
      severity: "",
      html_url: "https://github.com/advisories/GHSA-zzzz",
      published_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
      cvss: null,
      cwes: null,
      identifiers: null,
      type: "reviewed",
    };
    const topics = deriveTopics(advisory as any);
    expect(topics).toEqual([]);
  });
});

// -- Collector ---------------------------------------------------------------

describe("GithubAdvisoriesCollector.fetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const advisoriesResponse = [
    {
      ghsa_id: "GHSA-abcd-1234-efgh",
      cve_id: "CVE-2024-5678",
      summary: "Critical XSS in example-lib",
      description: "A detailed description of the advisory.",
      severity: "high",
      html_url: "https://github.com/advisories/GHSA-abcd-1234-efgh",
      published_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
      cvss: {
        score: 8.1,
        vector_string: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N",
      },
      cwes: [{ cwe_id: "CWE-79", name: "XSS" }],
      identifiers: [
        { type: "CVE", value: "CVE-2024-5678" },
        { type: "GHSA", value: "GHSA-abcd-1234-efgh" },
      ],
      type: "reviewed",
    },
  ];

  it("maps advisories to RawItem[] on successful fetch", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(advisoriesResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collector = new GithubAdvisoriesCollector();
    const items = await collector.fetch();

    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.sourceId).toBe("GHSA-abcd-1234-efgh");
    expect(item.itemType).toBe("advisory");
    expect(item.title).toBe("Critical XSS in example-lib");
    expect(item.content).toBe("A detailed description of the advisory.");
    expect(item.url).toBe("https://github.com/advisories/GHSA-abcd-1234-efgh");
    expect(item.topics).toEqual(["cwe-79", "high"]);
    expect(item.publishedAt).toEqual(new Date("2024-01-15T10:00:00Z"));
    expect((item.meta as any).severity).toBe("high");
    expect((item.meta as any).cvss_score).toBe(8.1);
    expect((item.meta as any).cwe_ids).toEqual(["CWE-79"]);
  });

  it("returns empty array on API error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Rate limited", { status: 429 }),
    );

    const collector = new GithubAdvisoriesCollector();
    const items = await collector.fetch();

    expect(items).toEqual([]);
  });
});
