# Configuration

All configuration is via environment variables, validated at startup with Zod. Copy `.env.example` to `.env` and fill in the values you need.

**File**: `src/config.ts`

## Environment Variables

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DATABASE_URL` | string | `postgresql://coronagraph:coronagraph@localhost:5432/coronagraph` | no | PostgreSQL connection string |
| `PORT` | number | `3000` | no | Web server port |
| `ANTHROPIC_API_KEY` | string | - | no | Anthropic API key for Claude |
| `INOREADER_APP_ID` | string | - | no | Inoreader OAuth application ID |
| `INOREADER_APP_KEY` | string | - | no | Inoreader OAuth application key |
| `INOREADER_TOKEN` | string | - | no | Inoreader bearer token |
| `TELEGRAM_BOT_TOKEN` | string | - | no | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | string | - | no | Default Telegram chat for delivery |
| `RESEND_API_KEY` | string | - | no | Resend API key for email |
| `EMAIL_TO` | string | - | no | Default email recipient |
| `EMBEDDING_API_KEY` | string | - | no | Voyage AI API key |
| `EMBEDDING_MODEL` | string | `voyage-3` | no | Voyage AI model name |
| `EMBEDDING_DIMENSIONS` | number | `1024` | no | Embedding vector dimensions |

## Feature Availability by Configuration

No environment variable is strictly required. Features gracefully degrade when their keys are missing:

| Feature | Required Variables | Behavior Without |
|---------|-------------------|------------------|
| Web dashboard | `DATABASE_URL` | Uses default local DB |
| Collection (NVD, CISA, GitHub, arXiv) | None | Works with public APIs |
| Collection (Inoreader) | `INOREADER_APP_ID`, `INOREADER_APP_KEY`, `INOREADER_TOKEN` | Collector returns empty array |
| AI summaries | `ANTHROPIC_API_KEY` | Falls back to content truncation (first 200 chars) |
| Embeddings | `EMBEDDING_API_KEY` | Items stored without vectors; no similarity search |
| Morning/weekly briefs | `ANTHROPIC_API_KEY` | Brief generation fails (returns null) |
| Alert evaluation | `ANTHROPIC_API_KEY` | Alert evaluation fails (returns empty) |
| Research sessions | `ANTHROPIC_API_KEY` | Sessions cannot start |
| Email delivery | `RESEND_API_KEY`, `EMAIL_TO` | Delivery skipped silently |
| Telegram delivery | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Delivery skipped silently |
| Telegram bot | `TELEGRAM_BOT_TOKEN` | Bot cannot start |
| MCP brief generation | `ANTHROPIC_API_KEY` | Falls back to raw summary list |
| MCP vector search | `EMBEDDING_API_KEY` | Falls back to FTS only |

## Config Singleton

The `getConfig()` function validates and caches the configuration on first call. Subsequent calls return the cached value. This means environment variable changes require a process restart.

!!! warning "Testing gotcha"
    The config singleton persists across tests in the same process. If your tests modify environment variables, you may need to reset the config cache between tests.
