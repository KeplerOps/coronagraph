# Query Patterns

**File**: `src/db/queries.ts` (core), `src/db/queries-web.ts` (web dashboard)

## Core Queries

### insertItem (Upsert)

```sql
INSERT INTO items (source, source_id, item_type, url, title, summary, content, meta, topics, published_at, embedding)
VALUES (...)
ON CONFLICT (source, source_id)
DO UPDATE SET
  item_type = EXCLUDED.item_type,
  url = EXCLUDED.url,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  meta = EXCLUDED.meta,
  topics = EXCLUDED.topics,
  published_at = EXCLUDED.published_at,
  embedding = EXCLUDED.embedding
RETURNING *;
```

Uses the unique `(source, source_id)` constraint. Re-ingesting the same item updates all fields. This makes collection jobs safe to re-run.

### getRecentItems (Filtered, Paginated)

```sql
SELECT * FROM items
WHERE ($source IS NULL OR source = $source)
  AND ($type IS NULL OR item_type = $type)
ORDER BY ingested_at DESC
LIMIT $limit OFFSET $offset;
```

Options:

| Parameter | Type | Default |
|-----------|------|---------|
| `source` | string | all |
| `type` | string | all |
| `limit` | number | 50 |
| `offset` | number | 0 |

### searchItems (Full-Text Search)

```sql
SELECT *,
  ts_rank(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
    plainto_tsquery('english', $query)
  ) AS rank
FROM items
WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  @@ plainto_tsquery('english', $query)
ORDER BY rank DESC
LIMIT $limit;
```

Uses the GIN index on `to_tsvector('english', title || content)`. The `plainto_tsquery` function handles natural language input (no special syntax required from users).

Default limit: 20.

### similarItems (Vector Search)

```sql
SELECT *,
  embedding <=> $queryVector AS distance
FROM items
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $queryVector
LIMIT $limit;
```

Uses the IVFFlat index with cosine distance operator (`<=>`). Only searches items that have embeddings.

Default limit: 10.

### getItem (With Annotations)

```sql
SELECT items.*, annotations.*
FROM items
LEFT JOIN annotations ON annotations.item_id = items.id
WHERE items.id = $id;
```

Returns the item with all annotations attached. Returns `null` if the item doesn't exist.

### addAnnotation

```sql
INSERT INTO annotations (item_id, note)
VALUES ($itemId, $note)
RETURNING *;
```

## Web Dashboard Queries

### getRecentBriefs

```sql
SELECT * FROM briefs
ORDER BY generated_at DESC
LIMIT $limit;
```

Default limit: 100.

### getBrief

```sql
SELECT * FROM briefs WHERE id = $id;
```

### getCollections (With Item Count)

```sql
SELECT collections.*,
  COUNT(collection_items.item_id) AS item_count
FROM collections
LEFT JOIN collection_items ON collection_items.collection_id = collections.id
GROUP BY collections.id
ORDER BY collections.created_at DESC;
```

### getCollection (With Items)

```sql
SELECT collections.*, items.*
FROM collections
LEFT JOIN collection_items ON collection_items.collection_id = collections.id
LEFT JOIN items ON items.id = collection_items.item_id
WHERE collections.id = $id
ORDER BY collection_items.added_at DESC;
```

### createCollection

```sql
INSERT INTO collections (name, description)
VALUES ($name, $description)
RETURNING *;
```

### getSources

```sql
SELECT * FROM sources ORDER BY name;
```

### getScheduledJobs

```sql
SELECT * FROM scheduled_jobs ORDER BY name;
```

## Search Strategy

Coronagraph uses a hybrid search approach in the MCP server's `search_knowledge` tool:

1. **Full-text search**: PostgreSQL's `tsvector`/`tsquery` with English stemming and ranking
2. **Vector search**: Voyage AI embeddings with pgvector cosine similarity
3. **Merge**: Concatenate both result sets
4. **Deduplicate**: Remove items appearing in both sets (preserve first occurrence)
5. **Filter**: Apply source/type constraints post-search

This hybrid approach catches both exact keyword matches (FTS) and semantic similarity (vectors), providing better recall than either method alone.
