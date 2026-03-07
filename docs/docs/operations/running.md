# Running Coronagraph

## Package Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run dev` | Start web server with hot reload (`--watch`) |
| `start` | `bun run start` | Start web server (production) |
| `collect` | `bun run collect` | Run all collectors + ingest pipeline |
| `brief` | `bun run brief` | Generate morning brief or weekly digest |
| `alerts` | `bun run alerts` | Evaluate recent items for urgent alerts |
| `bot` | `bun run bot` | Start Telegram bot (long-polling) |
| `mcp` | `bun run mcp` | Start MCP server (stdio transport) |
| `db:generate` | `bun run db:generate` | Generate Drizzle migration files |
| `db:push` | `bun run db:push` | Push schema to database |
| `db:studio` | `bun run db:studio` | Open Drizzle Studio (database GUI) |
| `typecheck` | `bun run typecheck` | Run TypeScript type checker |
| `test` | `bun test` | Run all tests |
| `test:unit` | `bun run test:unit` | Run unit tests only |
| `test:integration` | `bun run test:integration` | Run integration tests only |
| `test:watch` | `bun run test:watch` | Run tests in watch mode |

## CLI Arguments

### brief

```bash
bun run brief              # Auto-detect: Sunday=weekly, else morning
bun run brief morning      # Force morning brief
bun run brief weekly       # Force weekly digest
```

### alerts

```bash
bun run alerts             # Default: last 4 hours, max 30 items
bun run alerts --hours 8   # Custom lookback window
```

## Typical Cron Schedule

```cron
# Collect from all sources every 2 hours
0 */2 * * * cd /path/to/coronagraph && bun run collect >> /var/log/coronagraph/collect.log 2>&1

# Morning brief at 7:00 AM
0 7 * * * cd /path/to/coronagraph && bun run brief >> /var/log/coronagraph/brief.log 2>&1

# Alert evaluation every 4 hours
0 */4 * * * cd /path/to/coronagraph && bun run alerts >> /var/log/coronagraph/alerts.log 2>&1
```

The brief job auto-detects Sunday for weekly digests, so a single daily cron entry handles both.

## Long-Running Services

Three components run as persistent processes:

| Service | Command | Transport |
|---------|---------|-----------|
| Web server | `bun run start` | HTTP on `PORT` (default 3000) |
| Telegram bot | `bun run bot` | Telegram long-polling |
| MCP server | `bun run mcp` | Stdio (launched by Claude Desktop) |

The web server and Telegram bot should run as systemd services or similar. The MCP server is typically launched on-demand by Claude Desktop/Code.

## MCP Server Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

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

### Claude Code

Add to your project's `.mcp.json` or global MCP config:

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
