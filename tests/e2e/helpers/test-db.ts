// ---------------------------------------------------------------------------
// Test database helper — manages a throwaway Postgres container
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../src/db/schema";

const TEST_DB_URL =
  "postgresql://coronagraph_test:coronagraph_test@localhost:5433/coronagraph_test";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Start the test database container and wait for it to be healthy.
 * Idempotent — safe to call multiple times.
 */
export async function startTestDb(): Promise<void> {
  execFileSync(
    "docker",
    ["compose", "-f", "docker-compose.test.yml", "up", "-d", "--wait"],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

/**
 * Get a Drizzle ORM instance connected to the test database.
 * Applies the schema on first call.
 */
export async function getTestDb() {
  if (db) return db;

  client = postgres(TEST_DB_URL, { max: 5 });
  db = drizzle(client, { schema });

  // Enable pgvector extension
  await client`CREATE EXTENSION IF NOT EXISTS vector`;

  // Push schema
  await pushSchema(client);

  return db;
}

/**
 * Create all tables from the Drizzle schema.
 */
async function pushSchema(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      url TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      meta JSONB,
      topics TEXT[],
      published_at TIMESTAMPTZ,
      ingested_at TIMESTAMPTZ DEFAULT now(),
      embedding vector(1024)
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS items_source_source_id_idx
    ON items (source, source_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config JSONB,
      enabled BOOLEAN DEFAULT true,
      last_fetched TIMESTAMPTZ,
      fetch_interval_minutes INTEGER DEFAULT 30
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS annotations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (collection_id, item_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brief_type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      items_used UUID[],
      generated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt_key TEXT NOT NULL,
      schedule TEXT NOT NULL,
      delivery JSONB,
      enabled BOOLEAN DEFAULT true,
      last_run TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS research_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic TEXT NOT NULL,
      started_at TIMESTAMPTZ DEFAULT now(),
      summary TEXT,
      transcript JSONB
    )
  `;
}

/**
 * Truncate all tables (fast cleanup between tests).
 */
export async function cleanTestDb(): Promise<void> {
  if (!client) return;
  await client`TRUNCATE sources, items, annotations, collections, collection_items, briefs, scheduled_jobs, research_sessions CASCADE`;
}

/**
 * Close the database connection. Call in afterAll.
 */
export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Stop the test database container. Call after all test suites.
 */
export function stopTestDb(): void {
  execFileSync(
    "docker",
    ["compose", "-f", "docker-compose.test.yml", "down", "-v"],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

export { TEST_DB_URL };
