import { describe, it, expect } from "bun:test";

/**
 * Tests for the embedding validation in similarItems().
 *
 * We cannot easily call the real similarItems without a database, so we
 * extract and test the validation logic directly.
 */

// The same validation used in src/db/queries.ts similarItems()
function validateEmbedding(embedding: number[]): void {
  if (!embedding.every(Number.isFinite)) {
    throw new Error("Invalid embedding");
  }
}

describe("similarItems embedding validation", () => {
  it("accepts a valid embedding of finite numbers", () => {
    expect(() => validateEmbedding([0.1, 0.2, -0.5, 1.0])).not.toThrow();
  });

  it("accepts an empty array", () => {
    expect(() => validateEmbedding([])).not.toThrow();
  });

  it("rejects NaN values", () => {
    expect(() => validateEmbedding([0.1, NaN, 0.3])).toThrow("Invalid embedding");
  });

  it("rejects Infinity", () => {
    expect(() => validateEmbedding([0.1, Infinity, 0.3])).toThrow("Invalid embedding");
  });

  it("rejects -Infinity", () => {
    expect(() => validateEmbedding([0.1, -Infinity, 0.3])).toThrow("Invalid embedding");
  });
});
