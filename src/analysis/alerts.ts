// ---------------------------------------------------------------------------
// Alert evaluation: triage incoming items and flag those needing attention
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config.ts";
import { getRecentItems } from "../db/queries.ts";
import type { Item } from "../db/schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertUrgency = "critical" | "high" | "medium" | "low";

export interface AlertEvaluation {
  item: Item;
  shouldAlert: boolean;
  urgency: AlertUrgency;
  reason: string;
  recommendedAction: string;
}

// ---------------------------------------------------------------------------
// Client singleton
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

// ---------------------------------------------------------------------------
// Evaluate a single item
// ---------------------------------------------------------------------------

async function evaluateItem(
  anthropic: Anthropic,
  item: Item,
): Promise<AlertEvaluation> {
  const prompt =
    `You are an alert triage analyst. Evaluate whether this item warrants an immediate alert notification.\n\n` +
    `## Item\n` +
    `**Title:** ${item.title}\n` +
    `**Type:** ${item.itemType}\n` +
    `**Source:** ${item.source}\n` +
    `**Summary:** ${item.summary || "No summary available"}\n` +
    `**Content:** ${(item.content || "No content available").slice(0, 3000)}\n\n` +
    `## Alert Criteria\n` +
    `An item warrants an alert if ANY of the following apply:\n` +
    `- Critical or high-severity vulnerability with known exploitation\n` +
    `- Vulnerability in widely-used software (Linux kernel, major browsers, cloud platforms, popular frameworks)\n` +
    `- Active exploitation or proof-of-concept published\n` +
    `- Major security incident affecting infrastructure I depend on\n` +
    `- Breakthrough AI/ML result with immediate practical implications\n` +
    `- Significant AI safety or alignment development\n\n` +
    `## Response Format\n` +
    `Respond with ONLY valid JSON, no markdown fencing:\n` +
    `{"should_alert": true, "urgency": "critical", "reason": "Brief explanation", "recommended_action": "What to do"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle potential markdown fencing)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        item,
        shouldAlert: false,
        urgency: "low",
        reason: "Failed to parse evaluation response",
        recommendedAction: "Review manually",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      should_alert?: boolean;
      urgency?: string;
      reason?: string;
      recommended_action?: string;
    };

    const urgency = (
      ["critical", "high", "medium", "low"].includes(parsed.urgency || "")
        ? parsed.urgency
        : "low"
    ) as AlertUrgency;

    return {
      item,
      shouldAlert: parsed.should_alert ?? false,
      urgency,
      reason: parsed.reason || "No reason provided",
      recommendedAction: parsed.recommended_action || "No action recommended",
    };
  } catch (err) {
    console.error(`[alerts] Error evaluating item ${item.id}:`, err);
    return {
      item,
      shouldAlert: false,
      urgency: "low",
      reason: "Evaluation failed due to an error",
      recommendedAction: "Review manually",
    };
  }
}

// ---------------------------------------------------------------------------
// Evaluate recent items for alerts
// ---------------------------------------------------------------------------

export interface EvaluateAlertsOpts {
  /** How many hours back to look (default: 4) */
  hoursBack?: number;
  /** Maximum items to evaluate per run (default: 30) */
  maxItems?: number;
}

export async function evaluateAlerts(
  opts: EvaluateAlertsOpts = {},
): Promise<AlertEvaluation[]> {
  const { hoursBack = 4, maxItems = 30 } = opts;

  const anthropic = getClient();
  if (!anthropic) {
    console.log("[alerts] No ANTHROPIC_API_KEY configured, skipping");
    return [];
  }

  // Fetch recent items
  const items = await getRecentItems({ limit: maxItems * 2 });
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const recentItems = items
    .filter((i) => i.ingestedAt && i.ingestedAt > cutoff)
    .slice(0, maxItems);

  if (recentItems.length === 0) {
    console.log("[alerts] No recent items to evaluate");
    return [];
  }

  console.log(
    `[alerts] Evaluating ${recentItems.length} items from the last ${hoursBack} hours`,
  );

  // Evaluate items in parallel with concurrency limit to avoid rate limits
  const concurrency = 5;
  const results: AlertEvaluation[] = [];

  for (let i = 0; i < recentItems.length; i += concurrency) {
    const batch = recentItems.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item) => evaluateItem(anthropic, item)),
    );
    results.push(...batchResults);
  }

  const alertWorthy = results.filter((r) => r.shouldAlert);
  console.log(
    `[alerts] ${alertWorthy.length}/${recentItems.length} items flagged as alert-worthy`,
  );

  // Sort by urgency: critical > high > medium > low
  const urgencyOrder: Record<AlertUrgency, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  alertWorthy.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return alertWorthy;
}
