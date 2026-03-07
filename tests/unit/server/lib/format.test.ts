import { describe, it, expect } from "bun:test";
import { relativeTime, formatDate, truncate } from "../../../../src/server/lib/format.ts";

describe("format", () => {
  // -----------------------------------------------------------------------
  // relativeTime
  // -----------------------------------------------------------------------
  describe("relativeTime", () => {
    it("returns 'unknown' for null input", () => {
      expect(relativeTime(null)).toBe("unknown");
    });

    it("returns 'unknown' for undefined input", () => {
      expect(relativeTime(undefined)).toBe("unknown");
    });

    it("returns 'just now' for a date less than 60 seconds ago", () => {
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      expect(relativeTime(thirtySecondsAgo)).toBe("just now");
    });

    it("returns minutes ago for a date between 1 and 59 minutes ago", () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(relativeTime(fiveMinutesAgo)).toBe("5m ago");
    });

    it("returns hours ago for a date between 1 and 23 hours ago", () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      expect(relativeTime(threeHoursAgo)).toBe("3h ago");
    });

    it("returns days ago for a date between 1 and 6 days ago", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(relativeTime(twoDaysAgo)).toBe("2d ago");
    });

    it("returns weeks ago for a date between 7 and 29 days ago", () => {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      expect(relativeTime(fourteenDaysAgo)).toBe("2w ago");
    });

    it("returns month and day format for dates 30+ days ago", () => {
      // Use a fixed date far enough in the past
      const oldDate = new Date("2024-03-15T12:00:00Z");
      const result = relativeTime(oldDate);
      expect(result).toBe("Mar 15");
    });

    it("accepts a date string and parses it correctly", () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      expect(relativeTime(tenMinutesAgo.toISOString())).toBe("10m ago");
    });

    it("returns 'just now' for a date exactly 0 seconds ago", () => {
      const now = new Date();
      expect(relativeTime(now)).toBe("just now");
    });
  });

  // -----------------------------------------------------------------------
  // formatDate
  // -----------------------------------------------------------------------
  describe("formatDate", () => {
    it("returns 'Unknown' for null input", () => {
      expect(formatDate(null)).toBe("Unknown");
    });

    it("returns 'Unknown' for undefined input", () => {
      expect(formatDate(undefined)).toBe("Unknown");
    });

    it("formats a valid Date object", () => {
      const date = new Date("2025-01-15T14:30:00Z");
      const result = formatDate(date);
      // The exact output depends on locale, but should contain key parts
      expect(result).toContain("January");
      expect(result).toContain("15");
      expect(result).toContain("2025");
    });

    it("formats a valid date string", () => {
      const result = formatDate("2025-06-01T09:00:00Z");
      expect(result).toContain("June");
      expect(result).toContain("1");
      expect(result).toContain("2025");
    });
  });

  // -----------------------------------------------------------------------
  // truncate
  // -----------------------------------------------------------------------
  describe("truncate", () => {
    it("returns empty string for null input", () => {
      expect(truncate(null, 100)).toBe("");
    });

    it("returns empty string for undefined input", () => {
      expect(truncate(undefined, 100)).toBe("");
    });

    it("returns the string unchanged when shorter than max", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("returns the string unchanged when exactly at max length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("truncates and appends ellipsis when string exceeds max", () => {
      const result = truncate("hello world this is a long string", 11);
      expect(result).toBe("hello world...");
    });

    it("trims trailing whitespace before appending ellipsis", () => {
      // "hello " is 6 chars; truncate at 6 keeps "hello " then trimEnd -> "hello"
      const result = truncate("hello world", 6);
      expect(result).toBe("hello...");
    });
  });
});
