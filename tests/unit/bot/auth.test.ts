// ---------------------------------------------------------------------------
// Tests for src/bot/auth.ts -- authorization middleware
// ---------------------------------------------------------------------------

import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test.
// ---------------------------------------------------------------------------

const defaultConfig = {
  ANTHROPIC_API_KEY: "test-key",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_TO: "test@example.com",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "12345",
  EMBEDDING_API_KEY: "test-embedding-key",
  EMBEDDING_MODEL: "voyage-3",
  EMBEDDING_DIMENSIONS: 1024,
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 3000,
};

let currentConfig = { ...defaultConfig };

mock.module("../../../src/config.ts", () => ({
  getConfig: () => currentConfig,
}));

// Import AFTER mocks are set up
const { parseAllowedChatIds, authMiddleware } = await import(
  "../../../src/bot/auth.ts"
);

// ---------------------------------------------------------------------------
// parseAllowedChatIds
// ---------------------------------------------------------------------------

describe("parseAllowedChatIds", () => {
  it("returns null when input is undefined", () => {
    expect(parseAllowedChatIds(undefined)).toBeNull();
  });

  it("returns null when input is empty string", () => {
    expect(parseAllowedChatIds("")).toBeNull();
  });

  it("returns null when input is whitespace only", () => {
    expect(parseAllowedChatIds("   ")).toBeNull();
  });

  it("parses a single chat ID", () => {
    const result = parseAllowedChatIds("12345");
    expect(result).not.toBeNull();
    expect(result!.size).toBe(1);
    expect(result!.has("12345")).toBe(true);
  });

  it("parses multiple comma-separated chat IDs", () => {
    const result = parseAllowedChatIds("12345,67890,11111");
    expect(result).not.toBeNull();
    expect(result!.size).toBe(3);
    expect(result!.has("12345")).toBe(true);
    expect(result!.has("67890")).toBe(true);
    expect(result!.has("11111")).toBe(true);
  });

  it("trims whitespace around chat IDs", () => {
    const result = parseAllowedChatIds(" 12345 , 67890 ");
    expect(result).not.toBeNull();
    expect(result!.has("12345")).toBe(true);
    expect(result!.has("67890")).toBe(true);
  });

  it("ignores empty entries from consecutive commas", () => {
    const result = parseAllowedChatIds("12345,,67890");
    expect(result).not.toBeNull();
    expect(result!.size).toBe(2);
  });

  it("handles negative chat IDs (group chats)", () => {
    const result = parseAllowedChatIds("-1001234567890");
    expect(result).not.toBeNull();
    expect(result!.has("-1001234567890")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------

describe("authMiddleware", () => {
  let consoleWarnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });

  it("allows authorized chat ID and calls next()", async () => {
    currentConfig = { ...defaultConfig, TELEGRAM_CHAT_ID: "12345" };

    // Re-import to get fresh middleware with updated config
    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx = {
      chat: { id: 12345 },
      reply: mock(() => Promise.resolve()),
    };
    const next = mock(() => Promise.resolve());

    await middleware(ctx as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("blocks unauthorized chat ID with 'Not authorized.' reply", async () => {
    currentConfig = { ...defaultConfig, TELEGRAM_CHAT_ID: "12345" };

    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx = {
      chat: { id: 99999 },
      reply: mock(() => Promise.resolve()),
    };
    const next = mock(() => Promise.resolve());

    await middleware(ctx as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith("Not authorized.");
  });

  it("supports multiple chat IDs (comma-separated)", async () => {
    currentConfig = { ...defaultConfig, TELEGRAM_CHAT_ID: "12345,67890" };

    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx1 = {
      chat: { id: 12345 },
      reply: mock(() => Promise.resolve()),
    };
    const next1 = mock(() => Promise.resolve());
    await middleware(ctx1 as any, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const ctx2 = {
      chat: { id: 67890 },
      reply: mock(() => Promise.resolve()),
    };
    const next2 = mock(() => Promise.resolve());
    await middleware(ctx2 as any, next2);
    expect(next2).toHaveBeenCalledTimes(1);

    // Unauthorized
    const ctx3 = {
      chat: { id: 11111 },
      reply: mock(() => Promise.resolve()),
    };
    const next3 = mock(() => Promise.resolve());
    await middleware(ctx3 as any, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(ctx3.reply).toHaveBeenCalledWith("Not authorized.");
  });

  it("allows all users when TELEGRAM_CHAT_ID is not configured (graceful degradation)", async () => {
    currentConfig = {
      ...defaultConfig,
      TELEGRAM_CHAT_ID: undefined as unknown as string,
    };

    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx = {
      chat: { id: 99999 },
      reply: mock(() => Promise.resolve()),
    };
    const next = mock(() => Promise.resolve());

    await middleware(ctx as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    // Should have logged a warning
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[bot] TELEGRAM_CHAT_ID is not configured. All users are allowed.",
    );
  });

  it("blocks when chat is missing from context", async () => {
    currentConfig = { ...defaultConfig, TELEGRAM_CHAT_ID: "12345" };

    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx = {
      chat: undefined,
      reply: mock(() => Promise.resolve()),
    };
    const next = mock(() => Promise.resolve());

    await middleware(ctx as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Not authorized.");
  });

  it("logs a warning for unauthorized access attempts", async () => {
    currentConfig = { ...defaultConfig, TELEGRAM_CHAT_ID: "12345" };

    const mod = await import("../../../src/bot/auth.ts");
    const middleware = mod.authMiddleware();

    const ctx = {
      chat: { id: 99999 },
      reply: mock(() => Promise.resolve()),
    };
    const next = mock(() => Promise.resolve());

    await middleware(ctx as any, next);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[bot] Unauthorized access attempt from chat ID: 99999",
    );
  });
});
