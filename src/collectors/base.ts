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
 * Metadata describing a collector's source for the `sources` table.
 * Every collector declares this so the collect job can auto-populate
 * source records.
 */
export interface SourceMetadata {
  /** Primary key — matches `collector.source` */
  id: string;
  /** Human-readable name */
  name: string;
  /** Source type (e.g. "api", "feed", "catalog") */
  type: string;
  /** Optional URL for the source's homepage or API root */
  url?: string;
  /** Short description of what this source provides */
  description?: string;
}

/**
 * Every collector exposes a read-only `source` tag (used as the `source`
 * column in the items table), a `sourceMetadata` descriptor for the sources
 * table, and a single `fetch()` method that returns zero or more normalised
 * items.
 *
 * Implementations MUST handle their own errors gracefully -- a failing
 * collector should log a warning and return an empty array rather than
 * throwing and bringing down the ingestion loop.
 */
export interface Collector {
  readonly source: string;
  readonly sourceMetadata: SourceMetadata;
  fetch(): Promise<RawItem[]>;
}
