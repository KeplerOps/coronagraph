// ---------------------------------------------------------------------------
// Tests for src/ingest/embedder.ts
// ---------------------------------------------------------------------------

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
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
const { embed } = await import("../../../src/ingest/embedder.ts");

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("embedder", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    currentConfig = { ...defaultConfig };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            object: "list",
            data: [
              {
                object: "embedding",
                index: 0,
                embedding: [0.1, 0.2, 0.3],
              },
            ],
            model: "voyage-3",
            usage: { total_tokens: 10 },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("returns embedding vector on success", async () => {
    const result = await embed("Test text for embedding");

    expect(result).not.toBeNull();
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Truncation
  // -----------------------------------------------------------------------

  it("truncates text to 8000 chars", async () => {
    const longText = "B".repeat(12000);

    await embed(longText);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.input.length).toBe(8000);
    expect(body.input).toBe("B".repeat(8000));
  });

  // -----------------------------------------------------------------------
  // No API key
  // -----------------------------------------------------------------------

  it("returns null when no EMBEDDING_API_KEY configured", async () => {
    currentConfig = {
      ...defaultConfig,
      EMBEDDING_API_KEY: undefined as unknown as string,
    };

    const result = await embed("Test text");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // API error (non-ok response)
  // -----------------------------------------------------------------------

  it("returns null on API error response", async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    );

    const result = await embed("Test text");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Network error
  // -----------------------------------------------------------------------

  it("returns null on network error", async () => {
    fetchSpy.mockImplementation(() =>
      Promise.reject(new Error("Network connection failed")),
    );

    const result = await embed("Test text");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Unexpected response shape
  // -----------------------------------------------------------------------

  it("returns null on unexpected response shape (missing data array)", async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            object: "list",
            model: "voyage-3",
            usage: { total_tokens: 10 },
            // data field is missing
          }),
        ),
      ),
    );

    const result = await embed("Test text");

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Correct model and dimensions from config
  // -----------------------------------------------------------------------

  it("sends correct model and dimensions from config", async () => {
    await embed("Test text");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];

    // Verify URL
    expect(callArgs[0]).toBe("https://api.voyageai.com/v1/embeddings");

    // Verify body
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.model).toBe("voyage-3");
    expect(body.output_dimension).toBe(1024);
    expect(body.input_type).toBe("document");

    // Verify auth header
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-embedding-key");
  });
});
