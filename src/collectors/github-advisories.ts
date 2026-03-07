// ---------------------------------------------------------------------------
// GitHub Security Advisories collector
// ---------------------------------------------------------------------------

import type { Collector, RawItem } from "./base.ts";

const ADVISORIES_URL = "https://api.github.com/advisories";

// -- GitHub Advisory API response shape (subset) ------------------------------

interface GhAdvisoryCvss {
  score: number | null;
  vector_string: string | null;
}

interface GhAdvisoryCwe {
  cwe_id: string;
  name: string;
}

interface GhAdvisoryIdentifier {
  type: string; // "CVE" | "GHSA"
  value: string;
}

interface GhAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  description: string | null;
  severity: string; // "low" | "medium" | "high" | "critical"
  html_url: string;
  published_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  cvss: GhAdvisoryCvss | null;
  cwes: GhAdvisoryCwe[] | null;
  identifiers: GhAdvisoryIdentifier[] | null;
  type: string;
}

// -- Helpers ------------------------------------------------------------------

/**
 * Derive topic tags from CWEs and severity.
 */
export function deriveTopics(advisory: GhAdvisory): string[] {
  const topics: string[] = [];

  // Add CWE IDs as topics
  if (advisory.cwes) {
    for (const cwe of advisory.cwes) {
      topics.push(cwe.cwe_id.toLowerCase());
    }
  }

  // Add severity level
  if (advisory.severity) {
    topics.push(advisory.severity.toLowerCase());
  }

  return topics;
}

// -- Collector ----------------------------------------------------------------

export class GithubAdvisoriesCollector implements Collector {
  readonly source = "github-advisories";

  async fetch(): Promise<RawItem[]> {
    try {
      const url = new URL(ADVISORIES_URL);
      url.searchParams.set("type", "reviewed");
      url.searchParams.set("per_page", "50");

      const headers: Record<string, string> = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const res = await fetch(url.toString(), { headers });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `GitHub Advisories API responded ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const advisories = (await res.json()) as GhAdvisory[];
      return this.mapItems(advisories);
    } catch (err) {
      console.error("[github-advisories] Fetch failed:", err);
      return [];
    }
  }

  // --------------------------------------------------------------------------

  private mapItems(advisories: GhAdvisory[]): RawItem[] {
    const items: RawItem[] = [];

    for (const adv of advisories) {
      items.push({
        sourceId: adv.ghsa_id,
        itemType: "advisory",
        title: adv.summary,
        content: adv.description ?? undefined,
        url: adv.html_url,
        meta: {
          severity: adv.severity,
          cvss_score: adv.cvss?.score ?? null,
          cwe_ids: (adv.cwes ?? []).map((c) => c.cwe_id),
          identifiers: adv.identifiers ?? [],
          published_at: adv.published_at,
          updated_at: adv.updated_at,
        },
        topics: deriveTopics(adv),
        publishedAt: new Date(adv.published_at),
      });
    }

    return items;
  }
}
