import { describe, it, expect } from "bun:test";
import { NvdCollector } from "../../../src/collectors/nvd.ts";
import { ArxivCollector } from "../../../src/collectors/arxiv.ts";
import { CisaKevCollector } from "../../../src/collectors/cisa-kev.ts";
import { GithubAdvisoriesCollector } from "../../../src/collectors/github-advisories.ts";
import { InoreaderCollector } from "../../../src/collectors/inoreader.ts";
import type { Collector, SourceMetadata } from "../../../src/collectors/base.ts";

// ---------------------------------------------------------------------------
// Verify that every collector declares sourceMetadata that is consistent
// with its `source` tag and conforms to the SourceMetadata shape.
// ---------------------------------------------------------------------------

const collectors: Collector[] = [
  new NvdCollector(),
  new ArxivCollector(),
  new CisaKevCollector(),
  new GithubAdvisoriesCollector(),
  new InoreaderCollector(),
];

describe("collector sourceMetadata", () => {
  for (const collector of collectors) {
    describe(collector.source, () => {
      it("has sourceMetadata with required fields", () => {
        const meta: SourceMetadata = collector.sourceMetadata;
        expect(meta.id).toBeString();
        expect(meta.id.length).toBeGreaterThan(0);
        expect(meta.name).toBeString();
        expect(meta.name.length).toBeGreaterThan(0);
        expect(meta.type).toBeString();
        expect(meta.type.length).toBeGreaterThan(0);
      });

      it("sourceMetadata.id matches collector.source", () => {
        expect(collector.sourceMetadata.id).toBe(collector.source);
      });

      it("sourceMetadata has a description", () => {
        expect(collector.sourceMetadata.description).toBeString();
        expect(collector.sourceMetadata.description!.length).toBeGreaterThan(0);
      });

      it("sourceMetadata has a url", () => {
        expect(collector.sourceMetadata.url).toBeString();
        expect(collector.sourceMetadata.url!).toStartWith("http");
      });
    });
  }

  it("all collectors have unique source IDs", () => {
    const ids = collectors.map((c) => c.sourceMetadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
