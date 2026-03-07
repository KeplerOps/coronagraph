# MCP Server

MCP server exposing 6 tools over stdio for Claude Desktop, Claude Code, or any MCP client.

## Setup

**File**: `src/mcp/server.ts`

| Setting | Value |
|---------|-------|
| Transport | Stdio |
| Server name | `coronagraph` |
| Version | `0.1.0` |
| Run command | `bun run mcp` |

### Claude Desktop configuration

Add to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "coronagraph": {
      "command": "bun",
      "args": ["run", "src/mcp/server.ts"],
      "cwd": "/path/to/coronagraph"
    }
  }
}
```

## Tools

### search_knowledge

Hybrid search combining full-text search and vector similarity.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | - | Search query |
| `source` | string | no | - | Filter by source (nvd, arxiv, etc.) |
| `type` | string | no | - | Filter by item type |
| `limit` | number | no | 10 | Max results |

**How it works**:

1. Runs full-text search (`searchItems`) using PostgreSQL `plainto_tsquery`
2. Generates query embedding via Voyage AI
3. Runs vector similarity search (`similarItems`) using cosine distance
4. Merges both result sets
5. Deduplicates by item ID (preserves order)
6. Applies source/type filters
7. Returns formatted item list

If embedding generation fails, falls back to FTS results only.

### get_recent

Fetches recently ingested items.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `source` | string | no | - | Filter by source |
| `type` | string | no | - | Filter by item type |
| `limit` | number | no | 20 | Max results |

### get_item

Retrieves a single item with full content and annotations.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | yes | - | Item UUID |

Returns: title, URL, source, type, summary, full content, metadata (JSON), topics, timestamps, and all annotations.

### annotate

Adds a note to an item.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `item_id` | string | yes | - | Item UUID |
| `note` | string | yes | - | Annotation text |

### create_collection

Creates a new named collection for organizing items.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | yes | - | Collection name |
| `description` | string | no | - | Collection description |

### generate_brief

Generates a brief on demand.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topics` | string[] | no | - | Filter items by topic tags |
| `time_range_hours` | number | no | 24 | Time window in hours |

**Process**:

1. Fetches recent items within the time range
2. Optionally filters by topic tags
3. Sends to Claude for synthesis (or falls back to raw summaries if no API key)
4. Stores the brief in the database
5. Returns full brief content

## Helper Functions

- `formatItem(item)` — converts an item to a readable text block with title, source, type, date, URL, summary, and topics
- `formatItemList(items)` — numbered list of formatted items
- `deduplicateById(items)` — removes duplicate items preserving first occurrence
