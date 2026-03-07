# Telegram Bot

Grammy-based Telegram bot for searching items, generating briefs, and running research sessions.

## Setup

**File**: `src/bot/bot.ts`

| Setting | Value |
|---------|-------|
| Framework | Grammy 1.40 |
| Run command | `bun run bot` |
| Required env | `TELEGRAM_BOT_TOKEN` |

The bot runs as a long-polling process (not webhooks).

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with available commands |
| `/brief` | Generate and display a morning brief on demand |
| `/recent [source]` | Show last 10 items, optionally filtered by source |
| `/search <query>` | Full-text search, returns top 5 results |
| `/item <id>` | Show full item details with annotations |
| `/research <topic>` | Start an interactive research session |
| `/end` | End the current research session with summary |

## Research Sessions

The bot maintains an in-memory map of active research sessions per chat ID.

### Flow

1. User sends `/research machine learning security`
2. Bot calls `startSession("machine learning security")`
3. Bot displays initial findings
4. User sends free-form follow-up messages
5. Bot detects active session and routes to `query(sessionId, message)`
6. Bot displays answer
7. User sends `/end`
8. Bot calls `endSession(sessionId)` and displays summary

### Free-form routing

When a message doesn't start with `/`:

- If the chat has an active research session → treated as a research follow-up
- Otherwise → treated as a search query (equivalent to `/search`)

## Message Formatting

### Markdown escaping

The bot uses Telegram's MarkdownV2 parse mode. Special characters are escaped:

```
_ * [ ] ( ) ~ ` > # + - = | { } . ! \
```

### Message splitting

Long messages are split at 4096-character boundaries using the same `splitMessage` logic as the delivery module:

1. Paragraph breaks (`\n\n`)
2. Line breaks (`\n`)
3. Word boundaries (spaces)
4. Hard cut as last resort

### Item display

Items are formatted as cards showing:

- Title (bold)
- Source and item type
- Publication date
- Source URL
- Summary (truncated)
- Item ID (for `/item` lookup)

Full item view (via `/item`) additionally shows:

- Complete metadata
- Full content
- All annotations with timestamps

## Error Handling

The bot has a global error handler that:

1. Logs the error with context
2. Sends a fallback "Something went wrong" reply to the user
3. Does not crash the bot process
