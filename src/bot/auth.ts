// ---------------------------------------------------------------------------
// Telegram Bot Authorization Middleware
// ---------------------------------------------------------------------------
// Checks that incoming messages are from authorized chat IDs.
// TELEGRAM_CHAT_ID supports comma-separated values (e.g., "12345,67890").
// If TELEGRAM_CHAT_ID is not configured, all users are allowed (graceful degradation).
// ---------------------------------------------------------------------------

import type { Context, NextFunction } from "grammy";
import { getConfig } from "../config.ts";

/**
 * Parse TELEGRAM_CHAT_ID into a Set of allowed chat ID strings.
 * Returns null if no chat IDs are configured (allow-all mode).
 */
export function parseAllowedChatIds(
  chatIdConfig: string | undefined,
): Set<string> | null {
  if (!chatIdConfig || chatIdConfig.trim() === "") {
    return null;
  }

  const ids = chatIdConfig
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");

  if (ids.length === 0) {
    return null;
  }

  return new Set(ids);
}

/**
 * Grammy middleware that enforces chat-level authorization.
 *
 * - If TELEGRAM_CHAT_ID is not set, logs a warning once and allows all users.
 * - If set, only chats whose ID appears in the comma-separated list are allowed.
 * - Unauthorized users receive a "Not authorized" reply and the handler chain stops.
 */
export function authMiddleware(): (ctx: Context, next: NextFunction) => Promise<void> {
  const config = getConfig();
  const allowedChatIds = parseAllowedChatIds(config.TELEGRAM_CHAT_ID);

  if (allowedChatIds === null) {
    console.warn(
      "[bot] TELEGRAM_CHAT_ID is not configured. All users are allowed.",
    );
  }

  return async (ctx: Context, next: NextFunction): Promise<void> => {
    // If no allowlist is configured, allow all (graceful degradation)
    if (allowedChatIds === null) {
      return next();
    }

    const chatId = ctx.chat?.id?.toString();

    if (!chatId || !allowedChatIds.has(chatId)) {
      console.warn(
        `[bot] Unauthorized access attempt from chat ID: ${chatId ?? "unknown"}`,
      );
      await ctx.reply("Not authorized.");
      return;
    }

    return next();
  };
}
