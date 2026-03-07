# Roadmap

## Current Status (v0.1)

### Working

- [x] 5 collectors: NVD, CISA KEV, GitHub Advisories, arXiv, Inoreader
- [x] Ingest pipeline with AI summarization (Claude Haiku) and embeddings (Voyage AI)
- [x] PostgreSQL storage with pgvector for vector similarity search
- [x] Full-text search with `ts_rank` ranking
- [x] Morning briefs (Haiku) and weekly digests (Sonnet)
- [x] Alert evaluation with urgency triage
- [x] Email delivery via Resend
- [x] Telegram delivery and bot with research sessions
- [x] Web dashboard with HTMX live filtering
- [x] MCP server with 6 tools for Claude Desktop/Code
- [x] Collections and annotations
- [x] Docker Compose for PostgreSQL with pgvector
- [x] Dockerfile for production deployment
- [x] Comprehensive unit test suite (22 test files)

### Needs Improvement

- [ ] **Inoreader collector**: Only fetches first page (100 items). Needs continuation token pagination for catching up after downtime.
- [ ] **Inoreader read marking**: Items should be marked as read after successful ingest to avoid re-processing. Requires Zone 2 API writes.
- [ ] **Inoreader unread filtering**: Fetch only unread items (`xt=user/-/state/com.google/read`) to reduce redundant processing.
- [ ] **Deduplication across sources**: NVD and CISA KEV can reference the same CVE. Cross-source dedup is not yet implemented.
- [ ] **Scheduled job execution**: The `scheduled_jobs` table exists but jobs are run via cron, not an internal scheduler.
- [ ] **Source table population**: The `sources` table exists but is not automatically populated by collectors.
- [ ] **Pagination in web dashboard**: "Load more" works but total count is not displayed.
- [ ] **Error tracking**: Errors are logged to console but not persisted or aggregated.

## Near-Term Goals

### Inoreader Integration Improvements

- Pagination with continuation tokens for full backlog sync
- Mark-as-read after successful ingest
- Unread-only filtering to reduce API budget usage
- Pull Inoreader's built-in AI summaries when available
- Label-based routing (e.g., "security" label → priority ingest)

### Data Quality

- Cross-source CVE deduplication (NVD + CISA KEV + GitHub Advisories)
- Content deduplication via embedding similarity (catch near-duplicates from Inoreader feeds)
- Item freshness tracking (detect stale items that should be archived)

### Operational

- Internal job scheduler to replace cron dependency
- Auto-populate `sources` table from collector registry
- Error persistence and basic alerting on collection failures
- Health check endpoint with collector status

## Future Ideas

None of these are committed. Listed for context on where the project might go.

- **Neo4j graph layer** — model CVE-affects-Product, Paper-cites-Paper relationships alongside PostgreSQL
- **Inoreader label routing** — map labels to collections, priority labels trigger immediate alert evaluation
- **Write-back to Inoreader** — star/tag items in Inoreader based on alert evaluation
- **Streaming brief output** — SSE to web dashboard, streaming to Telegram
- **Topic trend tracking** — frequency over time, emerging topic detection, co-occurrence
- **Research session improvements** — citation tracking, session export, external API queries during sessions
