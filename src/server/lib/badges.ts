/**
 * Color mappings for source and type badges.
 * Returns Tailwind CSS classes for background + text color.
 */

const SOURCE_COLORS: Record<string, string> = {
  nvd: "bg-red-500/15 text-red-400 border-red-500/20",
  arxiv: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  inoreader: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "cisa-kev": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "github-advisories": "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const TYPE_COLORS: Record<string, string> = {
  vulnerability: "bg-red-500/15 text-red-400 border-red-500/20",
  paper: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  article: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  advisory: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

const DEFAULT_BADGE = "bg-gray-500/15 text-gray-400 border-gray-500/20";

export function sourceColor(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] ?? DEFAULT_BADGE;
}

export function typeColor(itemType: string): string {
  return TYPE_COLORS[itemType.toLowerCase()] ?? DEFAULT_BADGE;
}

/**
 * Source display names.
 */
const SOURCE_LABELS: Record<string, string> = {
  nvd: "NVD",
  arxiv: "arXiv",
  inoreader: "Inoreader",
  "cisa-kev": "CISA KEV",
  "github-advisories": "GitHub Advisories",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * Type display names.
 */
const TYPE_LABELS: Record<string, string> = {
  vulnerability: "Vulnerability",
  paper: "Paper",
  article: "Article",
  advisory: "Advisory",
};

export function typeLabel(itemType: string): string {
  return TYPE_LABELS[itemType] ?? itemType;
}
