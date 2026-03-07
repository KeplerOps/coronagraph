// ---------------------------------------------------------------------------
// CISA Known Exploited Vulnerabilities (KEV) collector
// ---------------------------------------------------------------------------

import type { Collector, RawItem } from "./base.ts";

const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

/** Number of days to look back when filtering recently added entries. */
const LOOKBACK_DAYS = 7;

// -- CISA KEV response shapes ------------------------------------------------

interface KevVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string; // "YYYY-MM-DD"
  shortDescription: string;
  requiredAction: string;
  dueDate: string; // "YYYY-MM-DD"
  knownRansomwareCampaignUse: string; // "Known" | "Unknown"
  notes?: string;
}

interface KevResponse {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: KevVulnerability[];
}

// -- Helpers ------------------------------------------------------------------

/**
 * Parse a "YYYY-MM-DD" string into a Date at midnight UTC.
 */
export function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/**
 * Build an NVD detail URL for a given CVE ID.
 */
export function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

// -- Collector ----------------------------------------------------------------

export class CisaKevCollector implements Collector {
  readonly source = "cisa-kev";

  async fetch(): Promise<RawItem[]> {
    try {
      const res = await fetch(KEV_URL, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `CISA KEV API responded ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const data = (await res.json()) as KevResponse;
      return this.filterAndMap(data.vulnerabilities ?? []);
    } catch (err) {
      console.error("[cisa-kev] Fetch failed:", err);
      return [];
    }
  }

  // --------------------------------------------------------------------------

  private filterAndMap(vulns: KevVulnerability[]): RawItem[] {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);
    cutoff.setUTCHours(0, 0, 0, 0);

    const items: RawItem[] = [];

    for (const v of vulns) {
      const dateAdded = parseDate(v.dateAdded);
      if (dateAdded < cutoff) continue; // older than lookback window

      items.push({
        sourceId: v.cveID,
        itemType: "vulnerability",
        title: `${v.cveID}: ${v.vulnerabilityName}`,
        content: v.shortDescription,
        url: nvdUrl(v.cveID),
        meta: {
          vendor: v.vendorProject,
          product: v.product,
          dateAdded: v.dateAdded,
          dueDate: v.dueDate,
          knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
          requiredAction: v.requiredAction,
        },
        topics: ["known-exploited", v.vendorProject.toLowerCase()],
        publishedAt: dateAdded,
      });
    }

    return items;
  }
}
