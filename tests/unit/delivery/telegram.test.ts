// ---------------------------------------------------------------------------
// Tests for src/delivery/telegram.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test.
// We use a mutable config object so tests can override values without
// re-mocking the module (which leaks across test files in Bun).
// ---------------------------------------------------------------------------

const defaultConfig = {
  ANTHROPIC_API_KEY: "test-key",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_TO: "test@example.com",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "test-chat-id",
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
const {
  splitMessage,
  sendMessage,
  sendBrief,
  sendAlertNotification,
  sendToDefaultChat,
  sendBriefToDefaultChat,
} = await import("../../../src/delivery/telegram.ts");

// ---------------------------------------------------------------------------
// Pure function tests -- splitMessage
// ---------------------------------------------------------------------------

describe("splitMessage", () => {
  it("returns single chunk for short text", () => {
    const text = "Hello, world!";
    const result = splitMessage(text);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Hello, world!");
  });

  it("splits at paragraph boundary (double newline) for long text", () => {
    // Create text that exceeds 4096 chars with paragraph boundaries
    const paragraph1 = "A".repeat(2000);
    const paragraph2 = "B".repeat(2000);
    const paragraph3 = "C".repeat(2000);
    const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

    const result = splitMessage(text);

    expect(result.length).toBeGreaterThan(1);
    // Each chunk should be at most 4096 chars
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it("falls back to single newline, then space, then hard cut", () => {
    // Create text with no double newlines but has single newlines
    const lines: string[] = [];
    // Fill with lines that have single newlines only, exceeding 4096
    for (let i = 0; i < 100; i++) {
      lines.push("X".repeat(80));
    }
    const text = lines.join("\n");

    const result = splitMessage(text);

    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it("handles text exactly at 4096 chars", () => {
    const text = "Z".repeat(4096);
    const result = splitMessage(text);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// sendMessage tests
// ---------------------------------------------------------------------------

describe("sendMessage", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 123 },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("successful send returns success with messageId", async () => {
    const result = await sendMessage("chat-123", "Hello Telegram!");

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(123);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs[0]).toBe(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
    );
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.chat_id).toBe("chat-123");
    expect(body.text).toBe("Hello Telegram!");
    expect(body.disable_web_page_preview).toBe(true);
  });

  it("returns error when no TELEGRAM_BOT_TOKEN configured", async () => {
    currentConfig = {
      ...defaultConfig,
      TELEGRAM_BOT_TOKEN: undefined as unknown as string,
    };

    const result = await sendMessage("chat-123", "Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("TELEGRAM_BOT_TOKEN");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns error when API returns ok: false", async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            description: "Bad Request: chat not found",
          }),
        ),
      ),
    );

    const result = await sendMessage("bad-chat", "Hello");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Bad Request: chat not found");
  });
});

// ---------------------------------------------------------------------------
// sendBrief tests
// ---------------------------------------------------------------------------

describe("sendBrief", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 456 },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("sends single chunk message for short brief", async () => {
    const results = await sendBrief("chat-123", "Daily Brief", "All clear.");

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify the message does NOT have chunk prefix for single-chunk messages
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.text).not.toContain("[1/");
  });

  it("sends multi-chunk message with [n/N] prefix", async () => {
    // Create content long enough to require multiple chunks
    const longContent = "Long paragraph. ".repeat(500);

    const results = await sendBrief("chat-123", "Big Brief", longContent);

    expect(results.length).toBeGreaterThan(1);
    for (const r of results) {
      expect(r.success).toBe(true);
    }

    // Check first chunk has [1/N] prefix
    const firstBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(firstBody.text).toContain(`[1/${results.length}]`);

    // Check second chunk has [2/N] prefix
    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
    expect(secondBody.text).toContain(`[2/${results.length}]`);
  });

  it("returns error when no TELEGRAM_BOT_TOKEN configured", async () => {
    currentConfig = {
      ...defaultConfig,
      TELEGRAM_BOT_TOKEN: undefined as unknown as string,
    };

    const results = await sendBrief("chat-123", "Title", "Content");

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("TELEGRAM_BOT_TOKEN");
  });
});

// ---------------------------------------------------------------------------
// sendToDefaultChat / sendBriefToDefaultChat tests
// ---------------------------------------------------------------------------

describe("sendToDefaultChat", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 789 },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns error when no TELEGRAM_CHAT_ID configured", async () => {
    currentConfig = {
      ...defaultConfig,
      TELEGRAM_CHAT_ID: undefined as unknown as string,
    };

    const result = await sendToDefaultChat("Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("TELEGRAM_CHAT_ID");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("sendBriefToDefaultChat", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 999 },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns error when no TELEGRAM_CHAT_ID configured", async () => {
    currentConfig = {
      ...defaultConfig,
      TELEGRAM_CHAT_ID: undefined as unknown as string,
    };

    const results = await sendBriefToDefaultChat("Title", "Content");

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("TELEGRAM_CHAT_ID");
  });
});
