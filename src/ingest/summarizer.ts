// ---------------------------------------------------------------------------
// LLM summarization using Anthropic API
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config.ts";

let client: Anthropic | null = null;

/** Reset the cached client (for testing). */
export function _resetClient() { client = null; }

function getClient(): Anthropic | null {
  const config = getConfig();
  if (!config.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface SummaryResult {
  summary: string;
  topics: string[];
}

/**
 * Summarise a collected item using Claude and extract topic tags.
 *
 * Returns `null` when no API key is configured or if the LLM call fails --
 * the pipeline can fall back to a naive truncation in that case.
 */
export async function summarize(
  title: string,
  content: string,
  itemType: string,
): Promise<SummaryResult | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[summarizer] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  const prompt = `You are an intelligence analyst. Analyze this ${itemType} and provide:
1. A 2-3 sentence summary capturing the key points and significance.
2. A list of relevant topic tags (lowercase, hyphenated, e.g. "llm-security", "supply-chain").

Title: ${title}

Content: ${content?.slice(0, 4000) || "No content available"}

Respond in JSON format exactly like this:
{"summary": "...", "topics": ["tag1", "tag2"]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      topics?: unknown;
    };

    return {
      summary: parsed.summary || "",
      topics: Array.isArray(parsed.topics)
        ? (parsed.topics as string[])
        : [],
    };
  } catch (err) {
    console.error("[summarizer] Error:", err);
    return null;
  }
}
