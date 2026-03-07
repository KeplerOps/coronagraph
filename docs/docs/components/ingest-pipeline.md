# Ingest Pipeline

Takes raw items from collectors, summarizes with Claude, embeds with Voyage AI, and upserts into PostgreSQL.

## Pipeline Orchestration

**File**: `src/ingest/pipeline.ts`

The pipeline exposes two functions:

- `ingestFromCollector(collector)` — processes a single collector's output
- `ingestAll(collectors)` — runs all collectors sequentially

### Process per item

1. **Fetch**: Call `collector.fetch()` to get `RawItem[]`
2. **Summarize**: Send title + content to Claude Haiku for a structured summary
3. **Embed**: Send text to Voyage AI for a 1024-dimensional vector
4. **Store**: Upsert into PostgreSQL with `insertItem()`

### Error handling

Each item is processed independently. If summarization or embedding fails for one item, the pipeline continues with the next. Errors are counted in the `IngestResult`:

```typescript
interface IngestResult {
  source: string;
  fetched: number;
  ingested: number;
  errors: number;
}
```

## Summarizer

**File**: `src/ingest/summarizer.ts`

Generates structured summaries using Claude Haiku.

| Setting | Value |
|---------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Max tokens | 500 |
| Response format | JSON extracted via regex |

### Input

The summarizer receives the item's title, content, and item type. The prompt (defined in `prompts/summarize.md`) requests:

- A 2-3 sentence summary
- Lowercase, hyphenated topic tags

### Output

```typescript
interface SummaryResult {
  summary: string;
  topics: string[];
}
```

### Fallback behavior

- If `ANTHROPIC_API_KEY` is not set: returns `null`, and the pipeline uses `content.slice(0, 200)` as the summary
- If the API call fails: returns `null` with the same fallback
- JSON parsing uses regex `/\{[\s\S]*\}/` to extract JSON from the response text

### Testing note

The summarizer creates a singleton Anthropic client. Call `_resetClient()` in test setup to clear the cached client between tests.

## Embedder

**File**: `src/ingest/embedder.ts`

Generates vector embeddings using the Voyage AI API.

| Setting | Value |
|---------|-------|
| API endpoint | `https://api.voyageai.com/v1/embeddings` |
| Model | Configurable via `EMBEDDING_MODEL` (default: `voyage-3`) |
| Dimensions | Configurable via `EMBEDDING_DIMENSIONS` (default: 1024) |
| Input type | `document` |
| Input truncation | 8000 characters |

### Request

```json
{
  "model": "voyage-3",
  "input": ["truncated text..."],
  "input_type": "document",
  "output_dimension": 1024
}
```

### Authentication

Bearer token via the `EMBEDDING_API_KEY` environment variable.

### Fallback behavior

- If `EMBEDDING_API_KEY` is not set: returns `null`, item is stored without a vector
- If the API call fails: returns `null` with a logged warning

Items without embeddings are still stored and searchable via full-text search, but will not appear in vector similarity results.

## Pipeline Sequence

```
Collector.fetch()
    ↓
RawItem[] (normalized)
    ↓
For each item:
    ├── summarize(title, content, type)
    │   └── Claude Haiku → {summary, topics} or null
    ├── embed(title + " " + summary + " " + content)
    │   └── Voyage AI → number[1024] or null
    └── insertItem({...raw, summary, topics, embedding})
        └── UPSERT on (source, sourceId)
    ↓
IngestResult {source, fetched, ingested, errors}
```
