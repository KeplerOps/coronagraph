import { describe, it, expect } from "bun:test";
import {
  sourceColor,
  typeColor,
  sourceLabel,
  typeLabel,
} from "../../../../src/server/lib/badges.ts";

const DEFAULT_BADGE = "bg-gray-500/15 text-gray-400 border-gray-500/20";

describe("badges", () => {
  // -----------------------------------------------------------------------
  // sourceColor
  // -----------------------------------------------------------------------
  describe("sourceColor", () => {
    it("returns red classes for 'nvd'", () => {
      expect(sourceColor("nvd")).toBe(
        "bg-red-500/15 text-red-400 border-red-500/20",
      );
    });

    it("returns blue classes for 'arxiv'", () => {
      expect(sourceColor("arxiv")).toBe(
        "bg-blue-500/15 text-blue-400 border-blue-500/20",
      );
    });

    it("returns emerald classes for 'inoreader'", () => {
      expect(sourceColor("inoreader")).toBe(
        "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      );
    });

    it("returns orange classes for 'cisa-kev'", () => {
      expect(sourceColor("cisa-kev")).toBe(
        "bg-orange-500/15 text-orange-400 border-orange-500/20",
      );
    });

    it("returns purple classes for 'github-advisories'", () => {
      expect(sourceColor("github-advisories")).toBe(
        "bg-purple-500/15 text-purple-400 border-purple-500/20",
      );
    });

    it("returns default badge for unknown source", () => {
      expect(sourceColor("unknown-source")).toBe(DEFAULT_BADGE);
    });

    it("handles case insensitive input via toLowerCase", () => {
      expect(sourceColor("NVD")).toBe(
        "bg-red-500/15 text-red-400 border-red-500/20",
      );
    });

    it("handles mixed case input", () => {
      expect(sourceColor("ArXiv")).toBe(
        "bg-blue-500/15 text-blue-400 border-blue-500/20",
      );
    });
  });

  // -----------------------------------------------------------------------
  // typeColor
  // -----------------------------------------------------------------------
  describe("typeColor", () => {
    it("returns red classes for 'vulnerability'", () => {
      expect(typeColor("vulnerability")).toBe(
        "bg-red-500/15 text-red-400 border-red-500/20",
      );
    });

    it("returns blue classes for 'paper'", () => {
      expect(typeColor("paper")).toBe(
        "bg-blue-500/15 text-blue-400 border-blue-500/20",
      );
    });

    it("returns emerald classes for 'article'", () => {
      expect(typeColor("article")).toBe(
        "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      );
    });

    it("returns yellow classes for 'advisory'", () => {
      expect(typeColor("advisory")).toBe(
        "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
      );
    });

    it("returns default badge for unknown type", () => {
      expect(typeColor("report")).toBe(DEFAULT_BADGE);
    });

    it("handles case insensitive input", () => {
      expect(typeColor("VULNERABILITY")).toBe(
        "bg-red-500/15 text-red-400 border-red-500/20",
      );
    });
  });

  // -----------------------------------------------------------------------
  // sourceLabel
  // -----------------------------------------------------------------------
  describe("sourceLabel", () => {
    it("returns 'NVD' for 'nvd'", () => {
      expect(sourceLabel("nvd")).toBe("NVD");
    });

    it("returns 'arXiv' for 'arxiv'", () => {
      expect(sourceLabel("arxiv")).toBe("arXiv");
    });

    it("returns 'Inoreader' for 'inoreader'", () => {
      expect(sourceLabel("inoreader")).toBe("Inoreader");
    });

    it("returns 'CISA KEV' for 'cisa-kev'", () => {
      expect(sourceLabel("cisa-kev")).toBe("CISA KEV");
    });

    it("returns 'GitHub Advisories' for 'github-advisories'", () => {
      expect(sourceLabel("github-advisories")).toBe("GitHub Advisories");
    });

    it("returns the input string for unknown source", () => {
      expect(sourceLabel("my-custom-source")).toBe("my-custom-source");
    });
  });

  // -----------------------------------------------------------------------
  // typeLabel
  // -----------------------------------------------------------------------
  describe("typeLabel", () => {
    it("returns 'Vulnerability' for 'vulnerability'", () => {
      expect(typeLabel("vulnerability")).toBe("Vulnerability");
    });

    it("returns 'Paper' for 'paper'", () => {
      expect(typeLabel("paper")).toBe("Paper");
    });

    it("returns 'Article' for 'article'", () => {
      expect(typeLabel("article")).toBe("Article");
    });

    it("returns 'Advisory' for 'advisory'", () => {
      expect(typeLabel("advisory")).toBe("Advisory");
    });

    it("returns the input string for unknown type", () => {
      expect(typeLabel("custom-type")).toBe("custom-type");
    });
  });
});
