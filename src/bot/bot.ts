// ---------------------------------------------------------------------------
// Coronagraph Telegram Bot -- Grammy-based interactive intelligence interface
// ---------------------------------------------------------------------------
// Run with: bun run src/bot/bot.ts
// ---------------------------------------------------------------------------

import { Bot } from "grammy";
import { generateMorningBrief } from "../analysis/briefing.ts";
import {
  endSession,
  query as researchQuery,
  startSession,
} from "../analysis/research.ts";
import { getConfig } from "../config.ts";
import { getItem, getRecentItems, searchItems } from "../db/queries.ts";
import type { Annotation, Item } from "../db/schema.ts";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const config = getConfig();

if (!config.TELEGRAM_BOT_TOKEN) {
  console.error("[bot] TELEGRAM_BOT_TOKEN is not set. Exiting.");
  process.exit(1);
}

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// ---------------------------------------------------------------------------
// Active research sessions: chatId -> sessionId
// ---------------------------------------------------------------------------

const activeSessions = new Map<number, string>();

// ---------------------------------------------------------------------------
// Telegram MarkdownV2 helpers
// ---------------------------------------------------------------------------

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Escape all MarkdownV2 special characters so Telegram parses them literally.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/**
 * Split a message into chunks that fit within Telegram's 4096 character limit.
 * Splits on newline boundaries when possible.
 */
function splitMessage(text: string, maxLen = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to find a newline to split on within the allowed range
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt <= 0) {
      // No good newline -- fall back to a space
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt <= 0) {
      // No space either -- hard cut
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/**
 * Send a (potentially long) message, splitting into multiple messages if needed.
 * Uses MarkdownV2 parse mode.
 */
async function sendLongMessage(
  chatId: number,
  text: string,
  parseMode: "MarkdownV2" | "HTML" | undefined = "MarkdownV2",
): Promise<void> {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await bot.api.sendMessage(chatId, chunk, { parse_mode: parseMode });
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatItemShort(item: Item, index?: number): string {
  const prefix = index !== undefined ? `*${index}\\.*  ` : "";
  const title = escapeMarkdown(item.title || "Untitled");
  const source = escapeMarkdown(item.source);
  const itemType = escapeMarkdown(item.itemType);
  const date = item.publishedAt
    ? escapeMarkdown(item.publishedAt.toLocaleDateString("en-US"))
    : "Unknown";

  let line = `${prefix}*${title}*\n`;
  line += `   ${source} \\| ${itemType} \\| ${date}\n`;

  if (item.url) {
    // URLs must NOT have special characters escaped inside the (url) part
    const escapedLabel = escapeMarkdown("Link");
    line += `   [${escapedLabel}](${item.url})\n`;
  }

  if (item.summary) {
    const summary = escapeMarkdown(
      item.summary.length > 150
        ? `${item.summary.slice(0, 147)}...`
        : item.summary,
    );
    line += `   ${summary}\n`;
  }

  line += `   ID: \`${escapeMarkdown(item.id)}\``;
  return line;
}

function formatItemFull(item: Item & { annotations: Annotation[] }): string {
  const parts: string[] = [];

  parts.push(`*${escapeMarkdown(item.title || "Untitled")}*`);
  parts.push("");
  parts.push(`*Source:* ${escapeMarkdown(item.source)}`);
  parts.push(`*Type:* ${escapeMarkdown(item.itemType)}`);

  if (item.publishedAt) {
    parts.push(
      `*Published:* ${escapeMarkdown(item.publishedAt.toLocaleString("en-US"))}`,
    );
  }

  if (item.url) {
    parts.push(`*URL:* [${escapeMarkdown("Open")}](${item.url})`);
  }

  if (item.topics && item.topics.length > 0) {
    const tags = item.topics.map((t) => `\\#${escapeMarkdown(t)}`).join("  ");
    parts.push(`*Topics:* ${tags}`);
  }

  if (item.summary) {
    parts.push("");
    parts.push(`*Summary*`);
    parts.push(escapeMarkdown(item.summary));
  }

  if (item.content) {
    parts.push("");
    parts.push(`*Content*`);
    // Truncate content at 2000 chars before escaping to leave room for metadata
    const truncated =
      item.content.length > 2000
        ? `${item.content.slice(0, 1997)}...`
        : item.content;
    parts.push(escapeMarkdown(truncated));
  }

  if (item.annotations.length > 0) {
    parts.push("");
    parts.push(`*Annotations \\(${item.annotations.length}\\)*`);
    for (const ann of item.annotations) {
      const date = ann.createdAt
        ? escapeMarkdown(ann.createdAt.toLocaleString("en-US"))
        : "";
      parts.push(`\\- ${escapeMarkdown(ann.note)}  _${date}_`);
    }
  }

  parts.push("");
  parts.push(`ID: \`${escapeMarkdown(item.id)}\``);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// /start
// ---------------------------------------------------------------------------

bot.command("start", async (ctx) => {
  const welcome = [
    `*Welcome to Coronagraph*`,
    ``,
    `Your intelligence feed, accessible from Telegram\\.`,
    ``,
    `*Available commands:*`,
    ``,
    `/brief \\- Generate an on\\-demand morning intelligence brief`,
    `/recent \\[source\\] \\- Show the last 10 items \\(optionally filtered by source\\)`,
    `/search \\<query\\> \\- Full\\-text search across all items`,
    `/item \\<id\\> \\- Show full details for a specific item`,
    `/research \\<topic\\> \\- Start an interactive research session`,
    `/end \\- End the current research session and get a summary`,
    ``,
    `You can also send free\\-form text:`,
    `\\- If a research session is active, your message is treated as a follow\\-up question`,
    `\\- Otherwise it is treated as a search query`,
  ].join("\n");

  await ctx.reply(welcome, { parse_mode: "MarkdownV2" });
});

// ---------------------------------------------------------------------------
// /brief
// ---------------------------------------------------------------------------

bot.command("brief", async (ctx) => {
  const chatId = ctx.chat.id;

  await ctx.reply(
    escapeMarkdown("Generating morning brief... this may take a moment."),
    {
      parse_mode: "MarkdownV2",
    },
  );

  try {
    const brief = await generateMorningBrief();

    if (!brief) {
      await ctx.reply(
        escapeMarkdown(
          "Could not generate a brief. Either no recent items were found or the AI service is unavailable.",
        ),
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    const header = `*${escapeMarkdown(brief.title)}*\n\n`;
    const body = escapeMarkdown(brief.content);
    const footer = `\n\n_Based on ${escapeMarkdown(String(brief.itemIds.length))} items_`;

    const fullMessage = header + body + footer;
    await sendLongMessage(chatId, fullMessage);
  } catch (err) {
    console.error("[bot] /brief error:", err);
    await ctx.reply(
      escapeMarkdown(
        "An error occurred while generating the brief. Please try again later.",
      ),
      { parse_mode: "MarkdownV2" },
    );
  }
});

// ---------------------------------------------------------------------------
// /recent [source]
// ---------------------------------------------------------------------------

bot.command("recent", async (ctx) => {
  const chatId = ctx.chat.id;
  const source = ctx.match?.trim() || undefined;

  try {
    const items = await getRecentItems({ source, limit: 10 });

    if (items.length === 0) {
      const msg = source
        ? `No items found from source "${source}".`
        : "No recent items found.";
      await ctx.reply(escapeMarkdown(msg), { parse_mode: "MarkdownV2" });
      return;
    }

    const header = source
      ? `*Recent items from ${escapeMarkdown(source)}*\n\n`
      : `*Recent items*\n\n`;

    const lines = items.map((item, i) => formatItemShort(item, i + 1));
    const fullMessage = header + lines.join("\n\n");

    await sendLongMessage(chatId, fullMessage);
  } catch (err) {
    console.error("[bot] /recent error:", err);
    await ctx.reply(
      escapeMarkdown("An error occurred while fetching recent items."),
      { parse_mode: "MarkdownV2" },
    );
  }
});

// ---------------------------------------------------------------------------
// /search <query>
// ---------------------------------------------------------------------------

bot.command("search", async (ctx) => {
  const chatId = ctx.chat.id;
  const queryText = ctx.match?.trim();

  if (!queryText) {
    await ctx.reply(
      escapeMarkdown(
        "Usage: /search <query>\nExample: /search LLM vulnerability",
      ),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  try {
    const results = await searchItems(queryText, 5);

    if (results.length === 0) {
      await ctx.reply(escapeMarkdown(`No results found for "${queryText}".`), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const header = `*Search results for "${escapeMarkdown(queryText)}"*\n\n`;
    const lines = results.map((item, i) => formatItemShort(item, i + 1));
    const fullMessage = header + lines.join("\n\n");

    await sendLongMessage(chatId, fullMessage);
  } catch (err) {
    console.error("[bot] /search error:", err);
    await ctx.reply(escapeMarkdown("An error occurred while searching."), {
      parse_mode: "MarkdownV2",
    });
  }
});

// ---------------------------------------------------------------------------
// /item <id>
// ---------------------------------------------------------------------------

bot.command("item", async (ctx) => {
  const chatId = ctx.chat.id;
  const itemId = ctx.match?.trim();

  if (!itemId) {
    await ctx.reply(
      escapeMarkdown(
        "Usage: /item <id>\nCopy an ID from /recent or /search results.",
      ),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  try {
    const item = await getItem(itemId);

    if (!item) {
      await ctx.reply(escapeMarkdown(`Item not found: ${itemId}`), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const formatted = formatItemFull(item);
    await sendLongMessage(chatId, formatted);
  } catch (err) {
    console.error("[bot] /item error:", err);
    await ctx.reply(
      escapeMarkdown("An error occurred while fetching the item."),
      { parse_mode: "MarkdownV2" },
    );
  }
});

// ---------------------------------------------------------------------------
// /research <topic>
// ---------------------------------------------------------------------------

bot.command("research", async (ctx) => {
  const chatId = ctx.chat.id;
  const topic = ctx.match?.trim();

  if (!topic) {
    await ctx.reply(
      escapeMarkdown(
        "Usage: /research <topic>\nExample: /research transformer architecture attacks",
      ),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  // Check for an existing active session
  if (activeSessions.has(chatId)) {
    await ctx.reply(
      escapeMarkdown(
        "You already have an active research session. Use /end to close it before starting a new one.",
      ),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  await ctx.reply(
    escapeMarkdown(`Starting research session on "${topic}"...`),
    { parse_mode: "MarkdownV2" },
  );

  try {
    const session = await startSession(topic);

    if (!session) {
      await ctx.reply(
        escapeMarkdown(
          "Could not start research session. The AI service may be unavailable.",
        ),
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    activeSessions.set(chatId, session.sessionId);

    const header = `*Research session started*\n`;
    const topicLine = `*Topic:* ${escapeMarkdown(session.topic)}\n`;
    const itemsLine = `*Items found:* ${escapeMarkdown(String(session.itemsFound))}\n\n`;
    const findingsHeader = `*Initial Findings*\n`;
    const findings = escapeMarkdown(session.initialFindings);
    const footer = `\n\n_Send follow\\-up questions as regular messages\\. Use /end to close the session\\._`;

    const fullMessage =
      header + topicLine + itemsLine + findingsHeader + findings + footer;
    await sendLongMessage(chatId, fullMessage);
  } catch (err) {
    console.error("[bot] /research error:", err);
    await ctx.reply(
      escapeMarkdown("An error occurred while starting the research session."),
      { parse_mode: "MarkdownV2" },
    );
  }
});

// ---------------------------------------------------------------------------
// /end
// ---------------------------------------------------------------------------

bot.command("end", async (ctx) => {
  const chatId = ctx.chat.id;
  const sessionId = activeSessions.get(chatId);

  if (!sessionId) {
    await ctx.reply(escapeMarkdown("No active research session to end."), {
      parse_mode: "MarkdownV2",
    });
    return;
  }

  await ctx.reply(
    escapeMarkdown("Ending research session and generating summary..."),
    { parse_mode: "MarkdownV2" },
  );

  try {
    const summary = await endSession(sessionId);
    activeSessions.delete(chatId);

    if (!summary) {
      await ctx.reply(
        escapeMarkdown("Session ended, but no summary could be generated."),
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    const header = `*Research Session Summary*\n`;
    const topicLine = `*Topic:* ${escapeMarkdown(summary.topic)}\n`;
    const turnsLine = `*Total turns:* ${escapeMarkdown(String(summary.totalTurns))}\n\n`;
    const body = escapeMarkdown(summary.summary);

    const fullMessage = header + topicLine + turnsLine + body;
    await sendLongMessage(chatId, fullMessage);
  } catch (err) {
    console.error("[bot] /end error:", err);
    activeSessions.delete(chatId);
    await ctx.reply(
      escapeMarkdown("An error occurred while ending the session."),
      { parse_mode: "MarkdownV2" },
    );
  }
});

// ---------------------------------------------------------------------------
// Free-form text messages
// ---------------------------------------------------------------------------

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  // Ignore messages that start with / (unknown commands)
  if (text.startsWith("/")) return;

  const sessionId = activeSessions.get(chatId);

  if (sessionId) {
    // Route to research session
    try {
      const result = await researchQuery(sessionId, text);

      if (!result) {
        await ctx.reply(
          escapeMarkdown(
            "Could not process your question. The session may have expired or the AI service is unavailable.",
          ),
          { parse_mode: "MarkdownV2" },
        );
        return;
      }

      const answer = escapeMarkdown(result.answer);
      const footer = `\n\n_${escapeMarkdown(String(result.itemsReferenced.length))} items referenced_`;
      await sendLongMessage(chatId, answer + footer);
    } catch (err) {
      console.error("[bot] research query error:", err);
      await ctx.reply(
        escapeMarkdown(
          "An error occurred while processing your research question.",
        ),
        { parse_mode: "MarkdownV2" },
      );
    }
  } else {
    // Treat as a search query
    try {
      const results = await searchItems(text, 5);

      if (results.length === 0) {
        await ctx.reply(escapeMarkdown(`No results found for "${text}".`), {
          parse_mode: "MarkdownV2",
        });
        return;
      }

      const header = `*Search results for "${escapeMarkdown(text)}"*\n\n`;
      const lines = results.map((item, i) => formatItemShort(item, i + 1));
      const fullMessage = header + lines.join("\n\n");

      await sendLongMessage(chatId, fullMessage);
    } catch (err) {
      console.error("[bot] search error:", err);
      await ctx.reply(escapeMarkdown("An error occurred while searching."), {
        parse_mode: "MarkdownV2",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Global error handler -- prevents the bot from crashing on unhandled errors
// ---------------------------------------------------------------------------

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[bot] Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);

  // Attempt to notify the user, but don't let this throw again
  ctx
    .reply("An unexpected error occurred. Please try again.")
    .catch((replyErr) => {
      console.error("[bot] Failed to send error reply:", replyErr);
    });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

console.log("[bot] Starting Coronagraph Telegram bot...");
bot.start({
  onStart: (botInfo) => {
    console.log(`[bot] Coronagraph bot is running as @${botInfo.username}`);
  },
});
