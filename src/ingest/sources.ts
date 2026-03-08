// ---------------------------------------------------------------------------
// Source registration  --  upserts source records from collector metadata
// ---------------------------------------------------------------------------

import type { Collector } from "../collectors/base.ts";
import { upsertSource } from "../db/queries.ts";

/**
 * Register all collector sources in the database.  Each collector's
 * `sourceMetadata` is upserted so the sources table stays in sync with
 * the set of active collectors.  Errors are logged but never thrown --
 * a failed upsert should not prevent the collection run from proceeding.
 */
export async function registerSources(collectors: Collector[]): Promise<void> {
  console.log("[sources] Registering collector sources...");

  for (const collector of collectors) {
    try {
      const meta = collector.sourceMetadata;
      await upsertSource({
        id: meta.id,
        name: meta.name,
        type: meta.type,
        url: meta.url,
        description: meta.description,
      });
      console.log(`[sources] Registered: ${meta.id} (${meta.name})`);
    } catch (err) {
      console.error(`[sources] Failed to register ${collector.source}:`, err);
    }
  }
}
