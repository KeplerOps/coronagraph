// ---------------------------------------------------------------------------
// Collector interface and shared types
// ---------------------------------------------------------------------------

/**
 * A normalised item produced by any collector before it enters the database.
 * The `source` field is deliberately omitted here -- it is provided by the
 * Collector itself so callers do not have to repeat it on every item.
 */
export interface RawItem {
  sourceId: string;
  itemType: string;
  url?: string;
  title: string;
  content?: string;
  meta?: Record<string, unknown>;
  topics?: string[];
  publishedAt?: Date;
}

/**
 * Every collector exposes a read-only `source` tag (used as the `source`
 * column in the items table) and a single `fetch()` method that returns
 * zero or more normalised items.
 *
 * Implementations MUST handle their own errors gracefully -- a failing
 * collector should log a warning and return an empty array rather than
 * throwing and bringing down the ingestion loop.
 */
export interface Collector {
  readonly source: string;
  fetch(): Promise<RawItem[]>;
}
