# Collectors

Each collector fetches raw items from an external source and returns them in a normalized format.

## Collector Interface

Defined in `src/collectors/base.ts`:

```typescript
interface RawItem {
  sourceId: string;
  itemType: string;
  url?: string;
  title: string;
  content?: string;
  meta?: Record<string, unknown>;
  topics?: string[];
  publishedAt?: Date;
}

interface Collector {
  readonly source: string;
  fetch(): Promise<RawItem[]>;
}
```

Every collector must:

- Return `RawItem[]` (never throw — errors are caught by the pipeline)
- Set a unique `source` identifier used for deduplication
- Provide a stable `sourceId` per item (combined with `source` for upsert key)

## Collector Summary

| Collector | Source Tag | Item Type | API | Fetch Strategy | Dedup Key |
|-----------|-----------|-----------|-----|---------------|-----------|
| NVD | `nvd` | `vulnerability` | NVD REST 2.0 | Last 24h by publish date, 100/page | CVE ID |
| CISA KEV | `cisa-kev` | `vulnerability` | CISA JSON feed | Full feed, filter last 7d by dateAdded | CVE ID |
| GitHub Advisories | `github-advisories` | `advisory` | GitHub REST API | Type=reviewed, 50/page | GHSA ID |
| arXiv | `arxiv` | `paper` | arXiv Atom API | 4 CS categories, 50 results, by submit date | arXiv ID (versionless) |
| Inoreader | `inoreader` | `article` | Inoreader Reader API | Reading list stream, 100/page | Item hex ID |

## NVD Collector

**File**: `src/collectors/nvd.ts`

Fetches recently published CVEs from the National Vulnerability Database.

- **API endpoint**: `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Window**: Last 24 hours (`pubStartDate` / `pubEndDate`)
- **Page size**: 100 results
- **No authentication required**

### Extracted metadata

| Field | Source | Notes |
|-------|--------|-------|
| `cvss` | `metrics.cvssMetricV31` / `V30` / `V2` | Best available CVSS score + severity |
| `cwe` | `weaknesses[].description[].value` | Unique CWE IDs |
| `affected` | `configurations[].nodes[].cpeMatch[].criteria` | Vulnerable CPE strings (max 20) |
| `references` | `references[].url` | Reference URLs |

### Topic generation

Topics include CWE IDs (e.g., `cwe-79`), severity level (e.g., `critical`), and the tag `cve`.

## CISA KEV Collector

**File**: `src/collectors/cisa-kev.ts`

Fetches the CISA Known Exploited Vulnerabilities catalog — CVEs with confirmed active exploitation.

- **API endpoint**: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Lookback**: 7 days from current date
- **Downloads full catalog** and filters client-side by `dateAdded`
- **No authentication required**

### Extracted metadata

| Field | Source |
|-------|--------|
| `vendor` | `vendorProject` |
| `product` | `product` |
| `dateAdded` | `dateAdded` |
| `dueDate` | `requiredAction` deadline |
| `knownRansomwareCampaignUse` | `knownRansomwareCampaignUse` |
| `requiredAction` | `requiredAction` |

### Topic generation

Topics: `known-exploited` and the vendor name (lowercased).

## GitHub Advisories Collector

**File**: `src/collectors/github-advisories.ts`

Fetches reviewed security advisories from GitHub's advisory database.

- **API endpoint**: `https://api.github.com/advisories`
- **Query**: `type=reviewed`, `per_page=50`
- **Headers**: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`
- **No authentication required** (public endpoint)

### Extracted metadata

| Field | Source |
|-------|--------|
| `severity` | `severity` |
| `cvss.score` | `cvss.score` |
| `cwe_ids` | `cwe_ids[]` |
| `identifiers` | `identifiers[]` (CVE, GHSA) |

### Topic generation

Topics include CWE IDs (lowercased) and severity level.

## arXiv Collector

**File**: `src/collectors/arxiv.ts`

Fetches recent AI/ML and cybersecurity research papers.

- **API endpoint**: `http://export.arxiv.org/api/query`
- **Categories**: `cs.AI`, `cs.CR`, `cs.LG`, `cs.CL` (joined with OR)
- **Max results**: 50
- **Sort**: `submittedDate` descending
- **Parse method**: Regex-based Atom XML parsing (no XML library dependency)

### ID handling

arXiv IDs include version suffixes (e.g., `2401.12345v1`). The collector strips the version to produce a stable dedup key: `2401.12345`.

### Topic generation

Topics are the arXiv category terms (e.g., `cs.AI`, `cs.CR`).

## Inoreader Collector

**File**: `src/collectors/inoreader.ts`

Fetches items from the Inoreader reading list — the unified stream of all subscribed feeds.

- **API endpoint**: `https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list`
- **Page size**: 100 items (`n=100`)
- **Requires**: `INOREADER_APP_ID`, `INOREADER_APP_KEY`, `INOREADER_TOKEN`

### Content processing

- HTML is stripped from `summary.content` using regex
- HTML entities are decoded (`&amp;` → `&`, `&lt;` → `<`, etc.)
- Content is truncated to 4000 characters
- URL is extracted from canonical href or alternate link

### Topic extraction

Inoreader categories follow the pattern `/label/TopicName`. The collector extracts the label portion as topic tags.

### Authentication

Three headers are required on every request:

```
AppId: {INOREADER_APP_ID}
AppKey: {INOREADER_APP_KEY}
Authorization: Bearer {INOREADER_TOKEN}
```

If any credential is missing, the collector returns an empty array (graceful degradation).

See [Infrastructure](../architecture/infrastructure.md) for details on Inoreader as managed infrastructure.
