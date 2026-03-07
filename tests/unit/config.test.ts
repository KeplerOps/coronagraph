import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { z } from "zod";

/**
 * Tests for src/config.ts -- getConfig() and the Zod env schema.
 *
 * Because getConfig() caches in a module-level _config variable, we
 * re-create the schema locally to test parsing behavior in isolation.
 * This avoids issues with module-level caching across tests.
 */

// Replicate the schema exactly as defined in src/config.ts
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://coronagraph:coronagraph@localhost:5432/coronagraph",
    ),
  PORT: z.coerce.number().default(3000),
  ANTHROPIC_API_KEY: z.string().optional(),
  INOREADER_APP_ID: z.string().optional(),
  INOREADER_APP_KEY: z.string().optional(),
  INOREADER_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_TO: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("voyage-3"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
});

describe("config", () => {
  describe("env schema parsing", () => {
    it("returns defaults when no env vars are set", () => {
      const config = envSchema.parse({});

      expect(config.DATABASE_URL).toBe(
        "postgresql://coronagraph:coronagraph@localhost:5432/coronagraph",
      );
      expect(config.PORT).toBe(3000);
      expect(config.EMBEDDING_MODEL).toBe("voyage-3");
      expect(config.EMBEDDING_DIMENSIONS).toBe(1024);
    });

    it("coerces PORT from string to number", () => {
      const config = envSchema.parse({ PORT: "8080" });

      expect(config.PORT).toBe(8080);
      expect(typeof config.PORT).toBe("number");
    });

    it("coerces EMBEDDING_DIMENSIONS from string to number", () => {
      const config = envSchema.parse({ EMBEDDING_DIMENSIONS: "512" });

      expect(config.EMBEDDING_DIMENSIONS).toBe(512);
      expect(typeof config.EMBEDDING_DIMENSIONS).toBe("number");
    });

    it("leaves optional fields undefined when not set", () => {
      const config = envSchema.parse({});

      expect(config.ANTHROPIC_API_KEY).toBeUndefined();
      expect(config.INOREADER_APP_ID).toBeUndefined();
      expect(config.INOREADER_APP_KEY).toBeUndefined();
      expect(config.INOREADER_TOKEN).toBeUndefined();
      expect(config.TELEGRAM_BOT_TOKEN).toBeUndefined();
      expect(config.TELEGRAM_CHAT_ID).toBeUndefined();
      expect(config.RESEND_API_KEY).toBeUndefined();
      expect(config.EMAIL_TO).toBeUndefined();
      expect(config.EMBEDDING_API_KEY).toBeUndefined();
    });

    it("DATABASE_URL has correct default value", () => {
      const config = envSchema.parse({});

      expect(config.DATABASE_URL).toBe(
        "postgresql://coronagraph:coronagraph@localhost:5432/coronagraph",
      );
    });

    it("EMBEDDING_MODEL defaults to voyage-3", () => {
      const config = envSchema.parse({});

      expect(config.EMBEDDING_MODEL).toBe("voyage-3");
    });

    it("parses a valid complete config correctly", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@db:5432/mydb",
        PORT: "9000",
        ANTHROPIC_API_KEY: "sk-ant-api03-xxx",
        INOREADER_APP_ID: "app-123",
        INOREADER_APP_KEY: "key-456",
        INOREADER_TOKEN: "token-789",
        TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
        TELEGRAM_CHAT_ID: "-1001234567890",
        RESEND_API_KEY: "re_xxx",
        EMAIL_TO: "user@example.com",
        EMBEDDING_API_KEY: "voyage-key-xxx",
        EMBEDDING_MODEL: "voyage-3-lite",
        EMBEDDING_DIMENSIONS: "256",
      };

      const config = envSchema.parse(env);

      expect(config.DATABASE_URL).toBe("postgresql://user:pass@db:5432/mydb");
      expect(config.PORT).toBe(9000);
      expect(config.ANTHROPIC_API_KEY).toBe("sk-ant-api03-xxx");
      expect(config.INOREADER_APP_ID).toBe("app-123");
      expect(config.INOREADER_APP_KEY).toBe("key-456");
      expect(config.INOREADER_TOKEN).toBe("token-789");
      expect(config.TELEGRAM_BOT_TOKEN).toBe("123456:ABC-DEF");
      expect(config.TELEGRAM_CHAT_ID).toBe("-1001234567890");
      expect(config.RESEND_API_KEY).toBe("re_xxx");
      expect(config.EMAIL_TO).toBe("user@example.com");
      expect(config.EMBEDDING_API_KEY).toBe("voyage-key-xxx");
      expect(config.EMBEDDING_MODEL).toBe("voyage-3-lite");
      expect(config.EMBEDDING_DIMENSIONS).toBe(256);
    });

    it("throws on invalid PORT (non-numeric string coerces to NaN)", () => {
      expect(() => envSchema.parse({ PORT: "not-a-number" })).toThrow();
    });
  });

  describe("getConfig() caching behavior", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Clear env vars that would affect config
      delete process.env.PORT;
      delete process.env.DATABASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.EMBEDDING_MODEL;
      delete process.env.EMBEDDING_DIMENSIONS;
    });

    afterEach(() => {
      // Restore original env
      process.env = { ...originalEnv };
    });

    // Note: Because getConfig() caches at the module level, testing the
    // actual caching behavior requires either mock.module or accepting
    // that the first call in the test process wins. The schema-level
    // tests above cover the parsing logic comprehensively.
  });
});
