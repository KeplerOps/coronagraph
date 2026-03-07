import { mock } from "bun:test";
import type { Config } from "../../src/config.ts";

/**
 * A complete Config object with test-safe defaults.
 * Use this directly or spread with overrides.
 */
export const mockConfig: Config = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 3000,
  ANTHROPIC_API_KEY: "test-anthropic-key",
  INOREADER_APP_ID: "test-app-id",
  INOREADER_APP_KEY: "test-app-key",
  INOREADER_TOKEN: "test-token",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "test-chat-id",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_TO: "test@example.com",
  EMBEDDING_API_KEY: "test-embedding-key",
  EMBEDDING_MODEL: "voyage-3",
  EMBEDDING_DIMENSIONS: 1024,
};

/**
 * Set up a mock.module override for "../../src/config.ts" so that
 * getConfig() returns mockConfig (or a custom override).
 *
 * Returns a cleanup function that restores the original module.
 *
 * Usage:
 *   let cleanup: () => void;
 *   beforeEach(() => { cleanup = setupConfigMock(); });
 *   afterEach(() => { cleanup(); });
 */
export function setupConfigMock(overrides?: Partial<Config>): () => void {
  const config = { ...mockConfig, ...overrides };

  mock.module("../../src/config.ts", () => ({
    getConfig: () => config,
  }));

  return () => {
    // Restore original module by re-mocking with dynamic import
    // In practice, bun:test mock.module restores between test files
    // but this allows manual cleanup within a single file if needed.
    mock.restore();
  };
}
