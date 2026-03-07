// ---------------------------------------------------------------------------
// Intelligence brief generation: morning briefs and weekly digests
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config.ts";
import { getRecentItems } from "../db/queries.ts";
import { db } from "../db/client.ts";
import { briefs } from "../db/schema.ts";
import type { Item } from "../db/schema.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const config = getConfig();
  if (!config.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export function formatItemsForPrompt(items: Item[]): string {
  return items
    .map(
      (item, i) =>
        `[${i + 1}] ${item.title}\n` +
        `  Source: ${item.source} | Type: ${item.itemType}\n` +
        `  Summary: ${item.summary || "No summary"}\n` +
        `  URL: ${item.url || "N/A"}\n` +
        `  Published: ${item.publishedAt?.toISOString() || "Unknown"}`,
    )
    .join("\n\n");
}

function itemsWithinHours(items: Item[], hours: number): Item[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return items.filter((i) => i.publishedAt && i.publishedAt > cutoff);
}

function buildBreakdown(
  items: Item[],
  key: keyof Pick<Item, "source" | "itemType">,
): string {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = item[key] ?? "unknown";
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface BriefResult {
  title: string;
  content: string;
  itemIds: string[];
  briefId: string;
}

// ---------------------------------------------------------------------------
// Morning Brief
// ---------------------------------------------------------------------------

export async function generateMorningBrief(): Promise<BriefResult | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[briefing] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  // Fetch up to 200 recent items and filter to the last 24 hours
  const items = await getRecentItems({ limit: 200 });
  const recentItems = itemsWithinHours(items, 24);

  if (recentItems.length === 0) {
    console.log("[briefing] No items from the last 24 hours for morning brief");
    return null;
  }

  console.log(
    `[briefing] Generating morning brief from ${recentItems.length} items`,
  );

  const itemsText = formatItemsForPrompt(recentItems);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content:
          `You are a senior intelligence analyst preparing a morning brief for a technical leader focused on AI/ML research and cybersecurity.\n\n` +
          `Synthesize the following ${recentItems.length} items from the last 24 hours into a structured morning intelligence brief.\n\n` +
          `## Items\n${itemsText}\n\n` +
          `## Brief Structure\n\n` +
          `### Critical Alerts\nItems requiring immediate attention (critical vulnerabilities, active exploits, major security incidents).\n\n` +
          `### AI/ML Research Highlights\nNotable papers, breakthroughs, and developments in AI/ML.\n\n` +
          `### Cybersecurity Developments\nNew vulnerabilities, advisories, threat intelligence, and security tool releases.\n\n` +
          `### Emerging Trends\nCross-cutting themes and patterns observed across today's items.\n\n` +
          `### Recommended Actions\nSpecific items worth deeper investigation, with brief rationale.\n\n` +
          `## Guidelines\n` +
          `- Be concise but substantive - this is a busy person's daily scan\n` +
          `- Lead with the most important items\n` +
          `- Note connections between items when relevant\n` +
          `- Flag anything that requires action or follow-up\n` +
          `- Include item references by title for traceability`,
      },
    ],
  });

  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const title = `Morning Brief - ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  // Persist the brief
  const [brief] = await db
    .insert(briefs)
    .values({
      briefType: "morning",
      title,
      content,
      itemsUsed: recentItems.map((i) => i.id),
    })
    .returning();

  console.log(`[briefing] Morning brief stored: ${brief.id}`);

  return {
    title,
    content,
    itemIds: recentItems.map((i) => i.id),
    briefId: brief.id,
  };
}

// ---------------------------------------------------------------------------
// Weekly Digest
// ---------------------------------------------------------------------------

export async function generateWeeklyDigest(): Promise<BriefResult | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[briefing] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  // Fetch up to 500 recent items and filter to the last 7 days
  const items = await getRecentItems({ limit: 500 });
  const weekItems = itemsWithinHours(items, 7 * 24);

  if (weekItems.length === 0) {
    console.log("[briefing] No items from the last 7 days for weekly digest");
    return null;
  }

  console.log(
    `[briefing] Generating weekly digest from ${weekItems.length} items`,
  );

  const sourceBreakdown = buildBreakdown(weekItems, "source");
  const typeBreakdown = buildBreakdown(weekItems, "itemType");

  // Use Sonnet for the weekly digest -- more comprehensive analysis warrants
  // a more capable model. Truncate to 200 items to stay within context limits.
  const promptItems = weekItems.slice(0, 200);
  const itemsText = formatItemsForPrompt(promptItems);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content:
          `You are a senior intelligence analyst preparing a weekly strategic digest.\n\n` +
          `Analyze the following ${weekItems.length} items from the past week and produce a comprehensive weekly intelligence digest.\n\n` +
          `## Items\n${itemsText}\n\n` +
          `## Stats\n` +
          `Total items processed: ${weekItems.length}\n` +
          `By source: ${sourceBreakdown}\n` +
          `By type: ${typeBreakdown}\n\n` +
          `## Digest Structure\n\n` +
          `### Executive Summary\n3-5 sentence overview of the week's most significant developments.\n\n` +
          `### Top Stories\nThe 5-10 most important items of the week, with context and analysis.\n\n` +
          `### Trend Analysis\nPatterns, emerging themes, and shifts observed over the week.\n\n` +
          `### Vulnerability Landscape\nSummary of notable vulnerabilities, their severity distribution, and any active exploitation.\n\n` +
          `### Research Frontier\nKey papers and technical developments advancing the state of the art.\n\n` +
          `### Strategic Outlook\nForward-looking assessment: what to watch for in the coming week.\n\n` +
          `### Data Summary\n` +
          `- Total items processed: ${weekItems.length}\n` +
          `- By source: ${sourceBreakdown}\n` +
          `- By type: ${typeBreakdown}`,
      },
    ],
  });

  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const title = `Weekly Digest - Week of ${new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const [brief] = await db
    .insert(briefs)
    .values({
      briefType: "weekly",
      title,
      content,
      itemsUsed: weekItems.map((i) => i.id),
    })
    .returning();

  console.log(`[briefing] Weekly digest stored: ${brief.id}`);

  return {
    title,
    content,
    itemIds: weekItems.map((i) => i.id),
    briefId: brief.id,
  };
}
