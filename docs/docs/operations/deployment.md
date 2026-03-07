# Deployment

## Prerequisites

- **Bun** 1.x runtime ([install](https://bun.sh/docs/installation))
- **PostgreSQL 16** with the **pgvector** extension
- **Network access** to external APIs (NVD, CISA, GitHub, arXiv, Inoreader, Anthropic, Voyage AI, Resend, Telegram)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> coronagraph
cd coronagraph
bun install

# 2. Start PostgreSQL with pgvector
docker compose up -d

# 3. Configure
cp .env.example .env
# Edit .env with your API keys

# 4. Push schema to database
bun run db:push

# 5. Run initial collection
bun run collect

# 6. Start the web server
bun run dev
```

## Database Setup

### Using Docker Compose

The included `docker-compose.yml` starts PostgreSQL 16 with pgvector:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: coronagraph
      POSTGRES_PASSWORD: coronagraph
      POSTGRES_DB: coronagraph
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
```

```bash
docker compose up -d
```

### Manual PostgreSQL Setup

If using an existing PostgreSQL instance:

```sql
CREATE DATABASE coronagraph;
\c coronagraph
CREATE EXTENSION IF NOT EXISTS vector;
```

Then push the schema:

```bash
bun run db:push
```

### Schema Migrations

Drizzle manages migrations:

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:push

# Browse database with GUI
bun run db:studio
```

## Docker Deployment

The included `Dockerfile` builds a production image:

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

```bash
docker build -t coronagraph .
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  --name coronagraph \
  coronagraph
```

## Systemd Services

### Web Server

```ini
# /etc/systemd/system/coronagraph-web.service
[Unit]
Description=Coronagraph Web Server
After=network.target postgresql.service

[Service]
Type=simple
User=coronagraph
WorkingDirectory=/opt/coronagraph
EnvironmentFile=/opt/coronagraph/.env
ExecStart=/usr/local/bin/bun run src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Telegram Bot

```ini
# /etc/systemd/system/coronagraph-bot.service
[Unit]
Description=Coronagraph Telegram Bot
After=network.target postgresql.service

[Service]
Type=simple
User=coronagraph
WorkingDirectory=/opt/coronagraph
EnvironmentFile=/opt/coronagraph/.env
ExecStart=/usr/local/bin/bun run src/bot/bot.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable coronagraph-web coronagraph-bot
sudo systemctl start coronagraph-web coronagraph-bot
```

## Cron Jobs

```bash
# Edit crontab
crontab -e
```

```cron
# Collection every 2 hours
0 */2 * * * cd /opt/coronagraph && /usr/local/bin/bun run collect >> /var/log/coronagraph/collect.log 2>&1

# Morning brief at 7:00 AM (auto-detects Sunday for weekly)
0 7 * * * cd /opt/coronagraph && /usr/local/bin/bun run brief >> /var/log/coronagraph/brief.log 2>&1

# Alert evaluation every 4 hours
0 */4 * * * cd /opt/coronagraph && /usr/local/bin/bun run alerts >> /var/log/coronagraph/alerts.log 2>&1
```

Create the log directory:

```bash
sudo mkdir -p /var/log/coronagraph
sudo chown coronagraph:coronagraph /var/log/coronagraph
```

## Health Check

The web server exposes a health endpoint:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2026-03-07T12:00:00.000Z"}
```
