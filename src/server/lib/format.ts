/**
 * Format a date as a human-readable relative time string.
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "Jan 15"
 */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "unknown";

  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Format a date as a full human-readable string.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate a string to a max length, appending ellipsis if needed.
 */
export function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "";
  if (str.length <= max) return str;
  return `${str.slice(0, max).trimEnd()}...`;
}
