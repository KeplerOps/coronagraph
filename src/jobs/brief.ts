// ---------------------------------------------------------------------------
// CLI job: generate and deliver intelligence briefs
//
// Usage:
//   bun src/jobs/brief.ts           # Auto-detect: weekly on Sundays, morning otherwise
//   bun src/jobs/brief.ts morning   # Force morning brief
//   bun src/jobs/brief.ts weekly    # Force weekly digest
// ---------------------------------------------------------------------------

import {
  generateMorningBrief,
  generateWeeklyDigest,
} from "../analysis/briefing.ts";
import { sendBriefEmail } from "../delivery/email.ts";
import { sendBriefToDefaultChat } from "../delivery/telegram.ts";

type BriefType = "morning" | "weekly";

function determineBriefType(): BriefType {
  const explicit = process.argv[2] as string | undefined;
  if (explicit === "morning" || explicit === "weekly") return explicit;

  // Auto-detect: run weekly digest on Sundays, morning brief otherwise
  const dayOfWeek = new Date().getDay();
  return dayOfWeek === 0 ? "weekly" : "morning";
}

async function main(): Promise<void> {
  const briefType = determineBriefType();
  console.log(`[brief] Running ${briefType} brief generation...`);
  const start = Date.now();

  // Generate the brief
  const result =
    briefType === "weekly"
      ? await generateWeeklyDigest()
      : await generateMorningBrief();

  if (!result) {
    console.log(`[brief] No ${briefType} brief generated (no items or no API key)`);
    process.exit(0);
  }

  console.log(
    `[brief] Generated "${result.title}" (${result.content.length} chars, ${result.itemIds.length} items)`,
  );

  // Deliver via all configured channels in parallel
  const deliveries = await Promise.allSettled([
    sendBriefEmail(result.title, result.content),
    sendBriefToDefaultChat(result.title, result.content),
  ]);

  for (const delivery of deliveries) {
    if (delivery.status === "rejected") {
      console.error(`[brief] Delivery failed:`, delivery.reason);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[brief] Complete in ${elapsed}s`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[brief] Fatal error:", err);
  process.exit(1);
});
