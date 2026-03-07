// ---------------------------------------------------------------------------
// CLI entry point for running a full collection + ingestion cycle
// ---------------------------------------------------------------------------

import { InoreaderCollector } from "../collectors/inoreader.ts";
import { NvdCollector } from "../collectors/nvd.ts";
import { ArxivCollector } from "../collectors/arxiv.ts";
import { CisaKevCollector } from "../collectors/cisa-kev.ts";
import { GithubAdvisoriesCollector } from "../collectors/github-advisories.ts";
import { ingestAll, type IngestResult } from "../ingest/pipeline.ts";

async function main(): Promise<void> {
  console.log("[collect] Starting collection run...");
  const start = Date.now();

  const collectors = [
    new InoreaderCollector(),
    new NvdCollector(),
    new ArxivCollector(),
    new CisaKevCollector(),
    new GithubAdvisoriesCollector(),
  ];

  const results = await ingestAll(collectors);

  const total = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      ingested: acc.ingested + r.ingested,
      errors: acc.errors + r.errors,
    }),
    { fetched: 0, ingested: 0, errors: 0 },
  );

  console.log(
    `\n[collect] Complete in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
  console.log(
    `[collect] Total: ${total.fetched} fetched, ${total.ingested} ingested, ${total.errors} errors`,
  );

  for (const r of results) {
    console.log(
      `  ${r.source}: ${r.fetched} fetched, ${r.ingested} ingested, ${r.errors} errors`,
    );
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[collect] Fatal error:", err);
  process.exit(1);
});
