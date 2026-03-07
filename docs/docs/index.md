# Coronagraph

Coronagraph collects CVEs, security advisories, research papers, and RSS articles, then summarizes and embeds them for search and analysis. It generates daily/weekly briefs, triages alerts by urgency, and supports interactive research sessions against the collected knowledge base.

Single-operator tool. No auth, no multi-tenancy.

## What it does

- Collects from 5 sources: NVD, CISA KEV, GitHub Advisories, arXiv, Inoreader (up to 2,500 feeds)
- Summarizes items with Claude Haiku, embeds with Voyage AI (1024d vectors)
- Full-text + vector hybrid search via PostgreSQL and pgvector
- Generates morning briefs (Haiku) and weekly digests (Sonnet)
- Evaluates items for alert urgency, delivers critical/high via email and Telegram
- Multi-turn research sessions with KB context injection
- Delivers via email (Resend), Telegram bot, web dashboard, MCP server for Claude

## Quick Links

| Section | What you'll find |
|---------|-----------------|
| [Architecture Overview](architecture/overview.md) | System layers, external services, design principles, tech stack |
| [Data Flow](architecture/data-flow.md) | Sequence diagrams for collection, briefs, alerts, search, research |
| [Infrastructure](architecture/infrastructure.md) | Inoreader as managed content layer, API budget, build-vs-buy |
| [Collectors](components/collectors.md) | All 5 collectors: interface, APIs, fetch strategies, dedup |
| [Ingest Pipeline](components/ingest-pipeline.md) | Summarizer, embedder, pipeline orchestration |
| [Analysis](components/analysis.md) | Briefs, alerts, research sessions |
| [Delivery](components/delivery.md) | Email and Telegram delivery patterns |
| [Web Dashboard](components/web-dashboard.md) | Hono + HTMX routes and components |
| [MCP Server](components/mcp-server.md) | 6 tools for Claude integration |
| [Telegram Bot](components/telegram-bot.md) | Grammy bot commands and research sessions |
| [Database Schema](data/schema.md) | ER diagram, all tables, index strategy |
| [Query Patterns](data/queries.md) | Upsert, FTS, vector search, joins |
| [Configuration](operations/configuration.md) | All env vars, feature availability matrix |
| [Running](operations/running.md) | Scripts, CLI args, cron schedules, MCP setup |
| [Deployment](operations/deployment.md) | Docker, systemd, database setup |
| [Roadmap](roadmap.md) | Current status, improvements, future vision |
