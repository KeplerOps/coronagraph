// ---------------------------------------------------------------------------
// Research session support: interactive query/answer over the knowledge base
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config.ts";
import { searchItems } from "../db/queries.ts";
import { db } from "../db/client.ts";
import { researchSessions } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import type { Item, ResearchSession } from "../db/schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  /** Item IDs referenced in this turn */
  itemsReferenced?: string[];
  timestamp: string;
}

export interface SessionResult {
  sessionId: string;
  topic: string;
  initialFindings: string;
  itemsFound: number;
}

export interface QueryResult {
  answer: string;
  itemsReferenced: string[];
}

export interface SessionSummary {
  sessionId: string;
  topic: string;
  summary: string;
  totalTurns: number;
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
// Helpers
// ---------------------------------------------------------------------------

function formatSearchResults(items: Item[]): string {
  if (items.length === 0) return "No relevant items found in the knowledge base.";
  return items
    .map(
      (item, i) =>
        `[${i + 1}] ${item.title}\n` +
        `  Source: ${item.source} | Type: ${item.itemType}\n` +
        `  Summary: ${item.summary || "No summary"}\n` +
        `  URL: ${item.url || "N/A"}\n` +
        `  Published: ${item.publishedAt?.toISOString() || "Unknown"}\n` +
        `  Content: ${(item.content || "").slice(0, 500)}`,
    )
    .join("\n\n");
}

const SYSTEM_PROMPT =
  `You are a research assistant with access to a curated intelligence knowledge base covering AI/ML research, cybersecurity, and technology.\n\n` +
  `## Capabilities\n` +
  `- Analyze patterns and trends across collected intelligence\n` +
  `- Synthesize information from multiple sources\n` +
  `- Provide context and connections between items\n` +
  `- Generate focused research reports on specific topics\n\n` +
  `## Guidelines\n` +
  `- Ground your analysis in the actual items from the knowledge base\n` +
  `- Cite specific items by title when making claims\n` +
  `- Distinguish between what the data shows and your interpretation\n` +
  `- Flag gaps in coverage or areas where more data would be helpful\n` +
  `- Be direct and concise - prioritize insight over verbosity`;

// ---------------------------------------------------------------------------
// Start a new research session
// ---------------------------------------------------------------------------

export async function startSession(topic: string): Promise<SessionResult | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[research] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  console.log(`[research] Starting session on topic: ${topic}`);

  // Search the knowledge base for relevant items
  const results = await searchItems(topic, 20);

  const searchText = formatSearchResults(results);

  // Generate initial findings
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `I'm starting a research session on the topic: "${topic}"\n\n` +
          `Here are the relevant items from the knowledge base:\n\n${searchText}\n\n` +
          `Provide an initial overview of what the knowledge base contains on this topic. ` +
          `Highlight the key items, any patterns you see, and suggest specific questions I could ask to go deeper.`,
      },
    ],
  });

  const initialFindings =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  // Build initial transcript
  const transcript: TranscriptEntry[] = [
    {
      role: "user",
      content: `Research session started on topic: ${topic}`,
      timestamp: new Date().toISOString(),
    },
    {
      role: "assistant",
      content: initialFindings,
      itemsReferenced: results.map((r) => r.id),
      timestamp: new Date().toISOString(),
    },
  ];

  // Store session in DB
  const [session] = await db
    .insert(researchSessions)
    .values({
      topic,
      transcript: transcript as unknown as Record<string, unknown>,
    })
    .returning();

  console.log(`[research] Session created: ${session.id}`);

  return {
    sessionId: session.id,
    topic,
    initialFindings,
    itemsFound: results.length,
  };
}

// ---------------------------------------------------------------------------
// Query within an existing session
// ---------------------------------------------------------------------------

export async function query(
  sessionId: string,
  question: string,
): Promise<QueryResult | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[research] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  // Load the session
  const [session] = await db
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .limit(1);

  if (!session) {
    console.error(`[research] Session not found: ${sessionId}`);
    return null;
  }

  const transcript = (session.transcript as TranscriptEntry[] | null) || [];

  // Search for items relevant to this specific question
  const results = await searchItems(question, 15);
  const searchText = formatSearchResults(results);

  // Build the conversation messages from transcript (keep last 10 turns to
  // stay within context limits)
  const recentTranscript = transcript.slice(-10);
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const entry of recentTranscript) {
    messages.push({ role: entry.role, content: entry.content });
  }

  // Add the new question with search context
  messages.push({
    role: "user",
    content:
      `${question}\n\n` +
      `--- Knowledge Base Search Results ---\n${searchText}`,
  });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system:
      SYSTEM_PROMPT +
      `\n\nYou are in a research session about: "${session.topic}". ` +
      `The user is asking follow-up questions. Use the search results provided with each question, ` +
      `combined with context from earlier in the conversation.`,
    messages,
  });

  const answer =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const itemsReferenced = results.map((r) => r.id);

  // Append to transcript
  const updatedTranscript: TranscriptEntry[] = [
    ...transcript,
    {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    },
    {
      role: "assistant",
      content: answer,
      itemsReferenced,
      timestamp: new Date().toISOString(),
    },
  ];

  await db
    .update(researchSessions)
    .set({ transcript: updatedTranscript as unknown as Record<string, unknown> })
    .where(eq(researchSessions.id, sessionId));

  return { answer, itemsReferenced };
}

// ---------------------------------------------------------------------------
// End session: generate summary and close
// ---------------------------------------------------------------------------

export async function endSession(
  sessionId: string,
): Promise<SessionSummary | null> {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[research] No ANTHROPIC_API_KEY configured, skipping");
    return null;
  }

  // Load the session
  const [session] = await db
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .limit(1);

  if (!session) {
    console.error(`[research] Session not found: ${sessionId}`);
    return null;
  }

  const transcript = (session.transcript as TranscriptEntry[] | null) || [];

  if (transcript.length === 0) {
    console.log("[research] Empty transcript, nothing to summarize");
    return null;
  }

  // Build a condensed transcript for summarization
  const condensed = transcript
    .map(
      (entry) =>
        `[${entry.role.toUpperCase()}] ${entry.content.slice(0, 1000)}`,
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Summarize the following research session on "${session.topic}".\n\n` +
          `Provide:\n` +
          `1. Key findings and conclusions\n` +
          `2. Items and sources referenced\n` +
          `3. Open questions or areas for further research\n` +
          `4. Actionable takeaways\n\n` +
          `## Session Transcript\n${condensed}`,
      },
    ],
  });

  const summary =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  // Update the session with the summary
  await db
    .update(researchSessions)
    .set({ summary })
    .where(eq(researchSessions.id, sessionId));

  console.log(`[research] Session ${sessionId} ended and summarized`);

  return {
    sessionId,
    topic: session.topic,
    summary,
    totalTurns: transcript.length,
  };
}
