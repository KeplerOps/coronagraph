# Coronagraph

Collects CVEs, security advisories, research papers, and RSS articles; summarizes and embeds them; generates briefs and alerts.

## Stack

Bun, Hono, Drizzle ORM, PostgreSQL + pgvector, Claude (Haiku/Sonnet), Voyage AI embeddings

## Sources

NVD, CISA KEV, GitHub Advisories, arXiv, Inoreader (up to 2,500 feeds)

## Quick Start

```bash
cp .env.example .env   # fill in API keys
bun install
bun run db:push         # apply schema to database
bun run collect          # run collectors + ingest pipeline
bun run dev              # start web server
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start web server with hot reload |
| `bun run collect` | Run all collectors + ingest pipeline |
| `bun run brief` | Generate morning/weekly brief |
| `bun run alerts` | Evaluate recent items for urgent alerts |
| `bun run bot` | Start Telegram bot |
| `bun run mcp` | Start MCP server (stdio) |
| `bun test` | Run all tests |
| `bun run db:push` | Apply schema to database |

## Development

```bash
pip install pre-commit
pre-commit install
```

Pre-commit hooks run linting (Biome), security scanning (Checkov), type checking, and tests.

## Documentation

Full docs at `docs/` (built with MkDocs): architecture, data flow, collectors, pipeline, delivery, deployment, and CI/CD.
