# Data Flow

## Collection & Ingestion

`bun run collect` runs all collectors sequentially, pipes each batch through the ingest pipeline.

```mermaid
sequenceDiagram
    participant Job as collect.ts
    participant Col as Collector
    participant API as External API
    participant Sum as Summarizer
    participant Emb as Embedder
    participant DB as PostgreSQL

    Job->>Col: fetch()
    Col->>API: HTTP GET
    API-->>Col: Raw response
    Col-->>Job: RawItem[]

    loop Each RawItem
        Job->>Sum: summarize(title, content, type)
        alt ANTHROPIC_API_KEY set
            Sum->>Sum: Claude Haiku (JSON response)
            Sum-->>Job: {summary, topics}
        else No API key
            Sum-->>Job: null (use truncated content)
        end

        Job->>Emb: embed(text)
        alt EMBEDDING_API_KEY set
            Emb->>Emb: Voyage AI (1024d vector)
            Emb-->>Job: number[1024]
        else No API key
            Emb-->>Job: null
        end

        Job->>DB: insertItem (UPSERT)
        DB-->>Job: Item
    end

    Job-->>Job: Log IngestResult {source, fetched, ingested, errors}
```

Each collector has its own fetch strategy:

- **NVD**: Last 24 hours by publish date, 100 results per page
- **CISA KEV**: Full JSON feed, filtered to last 7 days by dateAdded
- **GitHub Advisories**: Type=reviewed, 50 per page, maps severity + CWE
- **arXiv**: 4 CS categories (AI, CR, LG, CL), 50 results, sorted by submit date
- **Inoreader**: Reading list stream, 100 items per page, extracts labels as topics

## Brief Generation

`bun run brief` generates daily or weekly summaries.

```mermaid
sequenceDiagram
    participant Job as brief.ts
    participant DB as PostgreSQL
    participant AI as Claude
    participant Email as Resend
    participant TG as Telegram

    Job->>Job: Detect type (Sunday=weekly, else morning)

    Job->>DB: getRecentItems(24h or 7d)
    DB-->>Job: Item[]

    alt Morning Brief
        Job->>AI: Claude Haiku (max 200 items)
        Note over AI: Sections: Critical Alerts,<br/>AI/ML Highlights,<br/>Cybersecurity, Trends,<br/>Recommended Actions
    else Weekly Digest
        Job->>AI: Claude Sonnet (max 500 items, truncated to 200)
        Note over AI: Sections: Executive Summary,<br/>Top Stories, Trends,<br/>Vulnerability Landscape,<br/>Research Frontier,<br/>Strategic Outlook
    end

    AI-->>Job: Brief content (markdown)
    Job->>DB: Store brief

    par Deliver
        Job->>Email: sendBriefEmail(title, content)
        Job->>TG: sendBriefToDefaultChat(title, content)
    end
```

## Alert Evaluation

The `bun run alerts` job triages recent items for urgency.

```mermaid
sequenceDiagram
    participant Job as evaluate-alerts.ts
    participant DB as PostgreSQL
    participant AI as Claude Haiku
    participant Email as Resend
    participant TG as Telegram

    Job->>DB: getRecentItems(last 4h, max 30)
    DB-->>Job: Item[]

    loop Batches of 5 (concurrent)
        Job->>AI: Evaluate item urgency
        Note over AI: Criteria: known exploitation,<br/>widely-used software,<br/>active exploits/POCs,<br/>major incidents,<br/>breakthrough AI/ML,<br/>AI safety developments
        AI-->>Job: {shouldAlert, urgency, reason, action}
    end

    Job->>Job: Sort by urgency (critical > high > medium > low)
    Job->>Job: Filter to critical + high for delivery

    par Deliver critical/high
        Job->>Email: sendAlertEmail(alerts)
        Job->>TG: sendAlertNotification(chatId, alerts)
    end
```

## MCP Search

The MCP server's `search_knowledge` tool combines full-text and vector search.

```mermaid
sequenceDiagram
    participant Client as Claude Desktop/Code
    participant MCP as MCP Server
    participant DB as PostgreSQL
    participant Emb as Voyage AI

    Client->>MCP: search_knowledge(query, filters)

    par Dual search
        MCP->>DB: searchItems(query) [FTS with ts_rank]
        MCP->>Emb: embed(query)
        Emb-->>MCP: query vector
        MCP->>DB: similarItems(vector) [cosine distance]
    end

    DB-->>MCP: FTS results
    DB-->>MCP: Vector results

    MCP->>MCP: Merge results
    MCP->>MCP: deduplicateById()
    MCP->>MCP: Apply source/type filters
    MCP->>MCP: formatItemList()
    MCP-->>Client: Formatted results
```

## Research Session

Interactive multi-turn research via the Telegram bot or MCP.

```mermaid
sequenceDiagram
    participant User as User (Telegram)
    participant Bot as Bot
    participant RS as Research Module
    participant DB as PostgreSQL
    participant AI as Claude Haiku

    User->>Bot: /research <topic>
    Bot->>RS: startSession(topic)
    RS->>DB: searchItems(topic, limit=20)
    DB-->>RS: Context items
    RS->>AI: Initial analysis with KB context
    AI-->>RS: Initial findings
    RS->>DB: Create research_session record
    RS-->>Bot: Session started + findings
    Bot-->>User: Initial findings

    loop Follow-up questions
        User->>Bot: Free-form question
        Bot->>RS: query(sessionId, question)
        RS->>DB: searchItems(question, limit=15)
        DB-->>RS: Additional context
        RS->>AI: Q&A with transcript (last 10 turns) + new context
        AI-->>RS: Answer
        RS->>DB: Append to transcript
        RS-->>Bot: Answer
        Bot-->>User: Response
    end

    User->>Bot: /end
    Bot->>RS: endSession(sessionId)
    RS->>AI: Summarize full transcript
    AI-->>RS: Session summary
    RS->>DB: Store summary
    RS-->>Bot: Summary
    Bot-->>User: Session summary
```
