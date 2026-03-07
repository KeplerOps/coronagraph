// ---------------------------------------------------------------------------
// Telegram message delivery via Bot API
// ---------------------------------------------------------------------------

import { getConfig } from "../config.ts";

// ---------------------------------------------------------------------------
// Telegram Bot API base URL
// ---------------------------------------------------------------------------

function apiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}

// ---------------------------------------------------------------------------
// Send a single message
// ---------------------------------------------------------------------------

export interface TelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export async function sendMessage(
  chatId: string,
  text: string,
  parseMode: "MarkdownV2" | "HTML" | undefined = undefined,
): Promise<TelegramResult> {
  const config = getConfig();

  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN configured, skipping");
    return { success: false, error: "TELEGRAM_BOT_TOKEN not configured" };
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    };

    if (parseMode) {
      body.parse_mode = parseMode;
    }

    const response = await fetch(
      apiUrl(config.TELEGRAM_BOT_TOKEN, "sendMessage"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };

    if (!data.ok) {
      console.error(`[telegram] API error: ${data.description}`);
      return { success: false, error: data.description };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[telegram] Failed to send message: ${message}`);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Split text into chunks that fit Telegram's 4096 char limit
// ---------------------------------------------------------------------------

const TELEGRAM_MAX_LENGTH = 4096;

export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a paragraph boundary (double newline)
    let splitIdx = remaining.lastIndexOf("\n\n", TELEGRAM_MAX_LENGTH);

    // Fall back to single newline
    if (splitIdx < TELEGRAM_MAX_LENGTH / 2) {
      splitIdx = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    }

    // Fall back to space
    if (splitIdx < TELEGRAM_MAX_LENGTH / 2) {
      splitIdx = remaining.lastIndexOf(" ", TELEGRAM_MAX_LENGTH);
    }

    // Last resort: hard cut
    if (splitIdx < TELEGRAM_MAX_LENGTH / 2) {
      splitIdx = TELEGRAM_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Send a brief (title + content), splitting if too long
// ---------------------------------------------------------------------------

export async function sendBrief(
  chatId: string,
  title: string,
  content: string,
): Promise<TelegramResult[]> {
  const config = getConfig();

  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN configured, skipping");
    return [{ success: false, error: "TELEGRAM_BOT_TOKEN not configured" }];
  }

  const fullText = `${title}\n${"=".repeat(Math.min(title.length, 40))}\n\n${content}`;
  const chunks = splitMessage(fullText);

  console.log(
    `[telegram] Sending brief in ${chunks.length} message${chunks.length > 1 ? "s" : ""}`,
  );

  const results: TelegramResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk =
      chunks.length > 1
        ? `[${i + 1}/${chunks.length}]\n${chunks[i]}`
        : chunks[i];

    const result = await sendMessage(chatId, chunk);
    results.push(result);

    if (!result.success) {
      console.error(
        `[telegram] Failed to send chunk ${i + 1}/${chunks.length}`,
      );
      break;
    }

    // Small delay between messages to avoid Telegram rate limits
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Send alert notifications
// ---------------------------------------------------------------------------

export interface TelegramAlertData {
  itemTitle: string;
  urgency: string;
  reason: string;
  recommendedAction: string;
  url?: string | null;
}

export async function sendAlertNotification(
  chatId: string,
  alerts: TelegramAlertData[],
): Promise<TelegramResult[]> {
  const config = getConfig();

  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN configured, skipping");
    return [{ success: false, error: "TELEGRAM_BOT_TOKEN not configured" }];
  }

  const results: TelegramResult[] = [];

  for (const alert of alerts) {
    const urgencyEmoji =
      alert.urgency === "critical"
        ? "!!"
        : alert.urgency === "high"
          ? "! "
          : "  ";

    const text =
      `[${urgencyEmoji}ALERT - ${alert.urgency.toUpperCase()}]\n\n` +
      `${alert.itemTitle}\n\n` +
      `Reason: ${alert.reason}\n\n` +
      `Action: ${alert.recommendedAction}` +
      (alert.url ? `\n\nSource: ${alert.url}` : "");

    const result = await sendMessage(chatId, text);
    results.push(result);

    // Small delay between messages
    if (alerts.indexOf(alert) < alerts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Convenience: send to the default configured chat
// ---------------------------------------------------------------------------

export async function sendToDefaultChat(
  text: string,
): Promise<TelegramResult> {
  const config = getConfig();

  if (!config.TELEGRAM_CHAT_ID) {
    console.log("[telegram] No TELEGRAM_CHAT_ID configured, skipping");
    return { success: false, error: "TELEGRAM_CHAT_ID not configured" };
  }

  return sendMessage(config.TELEGRAM_CHAT_ID, text);
}

export async function sendBriefToDefaultChat(
  title: string,
  content: string,
): Promise<TelegramResult[]> {
  const config = getConfig();

  if (!config.TELEGRAM_CHAT_ID) {
    console.log("[telegram] No TELEGRAM_CHAT_ID configured, skipping");
    return [{ success: false, error: "TELEGRAM_CHAT_ID not configured" }];
  }

  return sendBrief(config.TELEGRAM_CHAT_ID, title, content);
}
