# Analysis

Three analysis modules: brief generation, alert evaluation, and research sessions.

## Morning Briefs

**File**: `src/analysis/briefing.ts` — `generateMorningBrief()`

| Setting | Value |
|---------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Max tokens | 4,000 |
| Time window | Last 24 hours |
| Max items | 200 |
| Prompt | `prompts/morning-brief.md` |

### Brief structure

1. **Critical Alerts** — urgent vulnerabilities and incidents
2. **AI/ML Research Highlights** — notable papers and developments
3. **Cybersecurity Developments** — new CVEs, advisories, threat intelligence
4. **Emerging Trends** — cross-cutting patterns and themes
5. **Recommended Actions** — specific steps to take

### Output

```typescript
interface BriefResult {
  title: string;
  content: string;   // markdown
  itemIds: string[];  // UUIDs of items used
  briefId: string;    // stored brief UUID
}
```

The brief is stored in the `briefs` table with `brief_type = 'daily'`.

## Weekly Digests

**File**: `src/analysis/briefing.ts` — `generateWeeklyDigest()`

| Setting | Value |
|---------|-------|
| Model | `claude-sonnet-4-5-20250514` |
| Max tokens | 8,000 |
| Time window | Last 7 days |
| Max items | 500 (truncated to 200 for prompt) |
| Prompt | `prompts/weekly-digest.md` |

Uses Sonnet (the more capable model) because weekly synthesis requires deeper analysis across a larger corpus.

### Digest structure

1. **Executive Summary** — 3-5 sentence overview
2. **Top Stories** — 5-10 most significant items
3. **Trend Analysis** — patterns across the week
4. **Vulnerability Landscape** — security posture summary
5. **Research Frontier** — notable AI/ML advances
6. **Strategic Outlook** — forward-looking analysis
7. **Data Summary** — item counts and source breakdown

Stored with `brief_type = 'weekly'`.

### Auto-detection

The `brief.ts` job auto-detects the brief type:

- **Sunday**: generates weekly digest
- **All other days**: generates morning brief
- Can be overridden with `bun run brief morning` or `bun run brief weekly`

## Alert Evaluation

**File**: `src/analysis/alerts.ts` — `evaluateAlerts()`

| Setting | Value |
|---------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Max tokens | 400 |
| Time window | Configurable, default 4 hours |
| Max items | Configurable, default 30 |
| Concurrency | 5 parallel evaluations |
| Prompt | `prompts/alert-evaluate.md` |

### Alert criteria

Items are evaluated against these criteria:

- Critical/high severity vulnerabilities with known exploitation
- Vulnerabilities in widely-used software (Linux, browsers, cloud platforms, frameworks)
- Active exploits or proof-of-concept code
- Major security incidents or breaches
- Breakthrough AI/ML developments with immediate practical implications
- Significant AI safety/alignment developments

### Urgency levels

| Level | Description |
|-------|-------------|
| `critical` | Requires immediate action |
| `high` | Should be addressed today |
| `medium` | Worth tracking, no immediate action |
| `low` | Informational only |

### Output

```typescript
interface AlertEvaluation {
  item: Item;
  shouldAlert: boolean;
  urgency: "critical" | "high" | "medium" | "low";
  reason: string;
  recommendedAction: string;
}
```

Results are sorted by urgency. Only `critical` and `high` alerts are delivered via email/Telegram.

### Concurrency

Items are evaluated in batches of 5 to balance throughput against API rate limits.

## Research Sessions

**File**: `src/analysis/research.ts`

Interactive multi-turn research conversations with knowledge base context injection.

| Setting | Value |
|---------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Initial context | Top 20 FTS results for topic |
| Follow-up context | Top 15 FTS results per question |
| Transcript window | Last 10 turns |
| Prompt | `prompts/research.md` |

### Session lifecycle

1. **Start** (`startSession(topic)`):
   - Search knowledge base for topic (top 20 items)
   - Send to Claude with system prompt for initial analysis
   - Create `research_sessions` record with transcript
   - Return initial findings

2. **Query** (`query(sessionId, question)`):
   - Search KB for the question (top 15 items)
   - Load existing transcript (last 10 turns for context window)
   - Send question + new context + transcript to Claude
   - Append Q&A to transcript in database
   - Return answer

3. **End** (`endSession(sessionId)`):
   - Load full transcript
   - Ask Claude to summarize the session
   - Store summary in database
   - Return session summary

### Transcript storage

Transcripts are stored as JSONB arrays:

```typescript
interface TranscriptEntry {
  role: string;
  content: string;
  itemsReferenced?: string[];
  timestamp: string;
}
```

### Access

Research sessions are accessible via:

- **Telegram bot**: `/research <topic>`, free-form follow-ups, `/end`
- **MCP server**: indirectly via `search_knowledge` and `generate_brief` tools
