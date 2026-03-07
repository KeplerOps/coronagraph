// ---------------------------------------------------------------------------
// NVD (National Vulnerability Database) CVE 2.0 API collector
// ---------------------------------------------------------------------------

import type { Collector, RawItem } from "./base.ts";

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";

// -- NVD API response shapes (subset) ----------------------------------------

interface NvdDescription {
  lang: string;
  value: string;
}

interface NvdReference {
  url: string;
  source?: string;
  tags?: string[];
}

interface NvdWeakness {
  source: string;
  type: string;
  description: NvdDescription[];
}

interface CvssData {
  baseScore: number;
  baseSeverity?: string;
}

interface CvssMetric {
  cvssData: CvssData;
}

interface CpeMatch {
  criteria: string;
  vulnerable: boolean;
}

interface CpeNode {
  cpeMatch?: CpeMatch[];
}

interface NvdConfiguration {
  nodes?: CpeNode[];
}

interface NvdCve {
  id: string;
  published: string;
  lastModified: string;
  descriptions: NvdDescription[];
  references?: NvdReference[];
  weaknesses?: NvdWeakness[];
  metrics?: {
    cvssMetricV31?: CvssMetric[];
    cvssMetricV30?: CvssMetric[];
    cvssMetricV2?: CvssMetric[];
  };
  configurations?: NvdConfiguration[];
}

interface NvdVulnerability {
  cve: NvdCve;
}

interface NvdResponse {
  vulnerabilities: NvdVulnerability[];
  totalResults: number;
  resultsPerPage: number;
}

// -- Helpers ------------------------------------------------------------------

/** Build an ISO 8601 datetime string the NVD API accepts (no millis). */
export function toNvdDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

/** Extract the best available CVSS base score from metrics. */
export function extractCvss(
  metrics: NvdCve["metrics"],
): { score: number; severity: string } | undefined {
  const m =
    metrics?.cvssMetricV31?.[0] ??
    metrics?.cvssMetricV30?.[0] ??
    metrics?.cvssMetricV2?.[0];
  if (!m) return undefined;
  return {
    score: m.cvssData.baseScore,
    severity: m.cvssData.baseSeverity ?? "UNKNOWN",
  };
}

/** Collect unique CWE IDs from the weaknesses array. */
export function extractCweIds(weaknesses: NvdWeakness[] | undefined): string[] {
  if (!weaknesses) return [];
  const ids = new Set<string>();
  for (const w of weaknesses) {
    for (const d of w.description) {
      if (d.lang === "en" && d.value.startsWith("CWE-")) {
        ids.add(d.value);
      }
    }
  }
  return [...ids];
}

/** Extract affected CPE criteria strings. */
export function extractAffected(
  configurations: NvdConfiguration[] | undefined,
): string[] {
  if (!configurations) return [];
  const affected: string[] = [];
  for (const cfg of configurations) {
    for (const node of cfg.nodes ?? []) {
      for (const match of node.cpeMatch ?? []) {
        if (match.vulnerable) {
          affected.push(match.criteria);
        }
      }
    }
  }
  return affected.slice(0, 20); // keep a reasonable number
}

// -- Collector ----------------------------------------------------------------

export class NvdCollector implements Collector {
  readonly source = "nvd";
  readonly sourceMetadata = {
    id: "nvd",
    name: "National Vulnerability Database",
    type: "api",
    url: "https://nvd.nist.gov",
    description: "NIST NVD CVE 2.0 API — recently published CVEs with CVSS scores, CWEs, and affected CPEs",
  };

  async fetch(): Promise<RawItem[]> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

      const url = new URL(NVD_API);
      url.searchParams.set("pubStartDate", toNvdDate(yesterday));
      url.searchParams.set("pubEndDate", toNvdDate(now));
      url.searchParams.set("resultsPerPage", "100");

      const res = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`NVD API responded ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as NvdResponse;
      return this.mapItems(data.vulnerabilities ?? []);
    } catch (err) {
      console.error("[nvd] Fetch failed:", err);
      return [];
    }
  }

  // --------------------------------------------------------------------------

  private mapItems(vulns: NvdVulnerability[]): RawItem[] {
    const items: RawItem[] = [];

    for (const { cve } of vulns) {
      const enDesc = cve.descriptions.find((d) => d.lang === "en");
      const description = enDesc?.value ?? "";

      const cvss = extractCvss(cve.metrics);
      const cweIds = extractCweIds(cve.weaknesses);
      const affected = extractAffected(cve.configurations);

      const topics = [...cweIds.map((id) => id.toLowerCase()), "cve"];
      if (cvss && cvss.severity) {
        topics.push(cvss.severity.toLowerCase());
      }

      items.push({
        sourceId: cve.id,
        itemType: "vulnerability",
        title: `${cve.id}: ${description.slice(0, 200)}`,
        content: description,
        url: cve.references?.[0]?.url,
        meta: {
          cvss: cvss ?? null,
          cwe: cweIds,
          affected,
          references: (cve.references ?? []).map((r) => r.url).slice(0, 10),
        },
        topics,
        publishedAt: new Date(cve.published),
      });
    }

    return items;
  }
}
