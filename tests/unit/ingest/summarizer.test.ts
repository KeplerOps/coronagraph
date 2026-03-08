// ---------------------------------------------------------------------------
// Tests for src/ingest/summarizer.ts
//
// Uses the shared FakeAnthropic from mock-anthropic.ts so that all test files
// share a single mock.module("@anthropic-ai/sdk") call and avoid conflicts
// caused by Bun's global mock.module registry.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { setupAnthropicMock } from "../../helpers/mock-anthropic.ts";

// ---------------------------------------------------------------------------
// Shared mock setup -- must run before importing the module under test
// ---------------------------------------------------------------------------

const fakeAnthropic = setupAnthropicMock();

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
const { summarize, _resetClient } = await import(
  "../../../src/ingest/summarizer.ts"
);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("summarizer", () => {
  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    // Reset the singleton so getClient() creates a new instance each test
    _resetClient();
    // Restore default create function (undoes any direct overrides from prior tests)
    fakeAnthropic.resetCreate();
    // Restore default response
    fakeAnthropic.setTextResponse(
      '{"summary": "Test summary", "topics": ["ai", "security"]}',
    );
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("returns summary and topics from valid JSON response", async () => {
    fakeAnthropic.setTextResponse(
      '{"summary": "A critical vulnerability was found.", "topics": ["web-security", "rce"]}',
    );

    const result = await summarize(
      "Test Title",
      "Test content",
      "vulnerability",
    );

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("A critical vulnerability was found.");
    expect(result?.topics).toEqual(["web-security", "rce"]);
  });

  // -----------------------------------------------------------------------
  // Markdown-fenced JSON
  // -----------------------------------------------------------------------

  it("handles markdown-fenced JSON in response", async () => {
    fakeAnthropic.setTextResponse(
      '```json\n{"summary": "Fenced summary", "topics": ["llm"]}\n```',
    );

    const result = await summarize("Title", "Content", "paper");

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Fenced summary");
    expect(result?.topics).toEqual(["llm"]);
  });

  // -----------------------------------------------------------------------
  // No API key
  // -----------------------------------------------------------------------

  it("returns null when no ANTHROPIC_API_KEY configured", async () => {
    currentConfig = {
      ...defaultConfig,
      ANTHROPIC_API_KEY: undefined as unknown as string,
    };

    const result = await summarize("Title", "Content", "article");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // API call throws
  // -----------------------------------------------------------------------

  it("returns null when API call throws", async () => {
    fakeAnthropic.messages.create = async () => {
      throw new Error("API rate limit exceeded");
    };

    const result = await summarize("Title", "Content", "advisory");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // No JSON in response
  // -----------------------------------------------------------------------

  it("returns null when response has no JSON", async () => {
    fakeAnthropic.setTextResponse(
      "I cannot parse this content into a proper format.",
    );

    const result = await summarize("Title", "Content", "article");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Empty topics array
  // -----------------------------------------------------------------------

  it("handles empty topics array", async () => {
    fakeAnthropic.setTextResponse(
      '{"summary": "Summary with no topics", "topics": []}',
    );

    const result = await summarize("Title", "Content", "article");

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Summary with no topics");
    expect(result?.topics).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Content truncation
  // -----------------------------------------------------------------------

  it("truncates content to 4000 chars in prompt", async () => {
    let capturedInput: string | undefined;
    fakeAnthropic.messages.create = async (params: unknown) => {
      const p = params as { messages: Array<{ content: string }> };
      capturedInput = p.messages[0].content;
      return {
        content: [
          {
            type: "text",
            text: '{"summary": "ok", "topics": []}',
          },
        ],
      };
    };

    const longContent = "A".repeat(10000);
    await summarize("Title", longContent, "article");

    if (!capturedInput) throw new Error("Expected capturedInput");
    expect(capturedInput).toContain("A".repeat(4000));
    expect(capturedInput).not.toContain("A".repeat(4001));
  });

  // -----------------------------------------------------------------------
  // Non-text content block
  // -----------------------------------------------------------------------

  it("returns null for non-text content blocks", async () => {
    fakeAnthropic.setResponse({
      content: [
        {
          type: "tool_use",
          id: "tool_1",
          name: "some_tool",
          input: {},
        },
      ],
    });

    const result = await summarize("Title", "Content", "article");

    // When content[0].type !== "text", text becomes "", no JSON match => null
    expect(result).toBeNull();
  });
});
