# Coronagraph

Collects CVEs, advisories, papers, and articles; summarizes and embeds them; generates briefs and alerts.

## Stack
Bun runtime, Hono web framework, Drizzle ORM, PostgreSQL + pgvector, Anthropic Claude, Voyage AI embeddings

## Commands
- `bun run dev` — start web server with hot reload
- `bun run collect` — run all collectors + ingest pipeline
- `bun run brief` — generate morning/weekly brief (auto-detects Sunday for weekly)
- `bun run alerts` — evaluate recent items for urgent alerts
- `bun run bot` — start Telegram bot
- `bun run mcp` — start MCP server (stdio)
- `bun test` / `bun test tests/unit` / `bun test tests/integration`
- `bun run db:push` — apply schema to database

## Conventions
- Graceful degradation: features disable when API keys are missing (no crashes)
- Upsert idempotency: `insertItem` uses ON CONFLICT (source, sourceId) DO UPDATE
- Model tiering: Haiku for volume tasks (summaries, alerts, research), Sonnet for depth (weekly digest)
- Collectors must never throw — errors are caught and logged, pipeline continues
- Zero build step: Bun runs TypeScript directly

## Gotchas
- `mock.module()` is global in Bun tests — it affects all tests in the file, not just the current test
- Config uses a singleton cache — call `_resetClient()` or equivalent in test setup
- Embedding truncation: input is capped at 8000 chars before sending to Voyage AI
- Telegram messages are split at 4096 chars with 300ms delay between sends
- ArXiv collector parses Atom XML via regex (no XML library)
- Vector index is IVFFlat — requires sufficient rows before it becomes effective

## Prohibited Actions
- Never run `git commit` — the user commits manually

## Key Paths
- `src/db/schema.ts` — all tables and indexes
- `src/collectors/base.ts` — Collector interface contract
- `src/ingest/pipeline.ts` — fetch → summarize → embed → store
- `src/config.ts` — all env vars with Zod validation
- `prompts/` — all LLM prompt templates

## Package Management
- Always use the package manager to install dependencies, do not add versions manually.
- Always search for the most current version of GitHub actions before adding them to workflows.
