// ---------------------------------------------------------------------------
// E2E tests for source registration against a real PostgreSQL database
// ---------------------------------------------------------------------------

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";
import { sources } from "../../src/db/schema";
import { startTestDb, stopTestDb, TEST_DB_URL } from "./helpers/test-db";

// ---------------------------------------------------------------------------
// Set up test DB connection and mock the db client module so all imports
// of src/db/client.ts use the test database instead of the default.
// ---------------------------------------------------------------------------

const testClient = postgres(TEST_DB_URL, { max: 5 });
const testDb = drizzle(testClient, { schema });

mock.module("../../src/db/client.ts", () => ({
  db: testDb,
  client: testClient,
}));

import { ArxivCollector } from "../../src/collectors/arxiv";
import { CisaKevCollector } from "../../src/collectors/cisa-kev";
import { GithubAdvisoriesCollector } from "../../src/collectors/github-advisories";
import { InoreaderCollector } from "../../src/collectors/inoreader";
import { NvdCollector } from "../../src/collectors/nvd";
// Now safe to import modules that use the DB
import { upsertSource } from "../../src/db/queries";
import { registerSources } from "../../src/ingest/sources";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startTestDb();

  // Enable pgvector and push schema
  await testClient`CREATE EXTENSION IF NOT EXISTS vector`;

  // Push schema using drizzle-kit
  execFileSync("bunx", ["drizzle-kit", "push", "--force"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
}, 60_000);

afterAll(async () => {
  await testClient.end();
  stopTestDb();
});

beforeEach(async () => {
  await testClient`TRUNCATE sources CASCADE`;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upsertSource (real DB)", () => {
  it("inserts a new source", async () => {
    const result = await upsertSource({
      id: "nvd",
      name: "National Vulnerability Database",
      type: "api",
      url: "https://nvd.nist.gov",
      description: "NVD CVE feed",
    });

    expect(result.id).toBe("nvd");
    expect(result.name).toBe("National Vulnerability Database");
    expect(result.type).toBe("api");
    expect(result.enabled).toBe(true);
    expect(result.fetchIntervalMinutes).toBe(30);
    expect(result.config).toEqual({
      url: "https://nvd.nist.gov",
      description: "NVD CVE feed",
    });
  });

  it("is idempotent — upserting same source twice succeeds", async () => {
    await upsertSource({
      id: "arxiv",
      name: "ArXiv",
      type: "api",
      url: "https://arxiv.org",
    });

    const result = await upsertSource({
      id: "arxiv",
      name: "ArXiv",
      type: "api",
      url: "https://arxiv.org",
    });

    expect(result.id).toBe("arxiv");

    const rows = await testDb
      .select()
      .from(sources)
      .where(eq(sources.id, "arxiv"));
    expect(rows).toHaveLength(1);
  });

  it("updates name and type on conflict", async () => {
    await upsertSource({
      id: "test-src",
      name: "Old Name",
      type: "feed",
    });

    const updated = await upsertSource({
      id: "test-src",
      name: "New Name",
      type: "api",
      url: "https://example.com",
    });

    expect(updated.name).toBe("New Name");
    expect(updated.type).toBe("api");
    expect(updated.config).toEqual({ url: "https://example.com" });
  });

  it("sets config to null when no url or description provided", async () => {
    const result = await upsertSource({
      id: "minimal",
      name: "Minimal Source",
      type: "catalog",
    });

    expect(result.config).toBeNull();
  });

  it("preserves enabled and fetch_interval defaults after upsert", async () => {
    const result = await upsertSource({
      id: "defaults-test",
      name: "Defaults Test",
      type: "api",
    });

    expect(result.enabled).toBe(true);
    expect(result.fetchIntervalMinutes).toBe(30);
    expect(result.lastFetched).toBeNull();
  });
});

describe("registerSources (real DB)", () => {
  it("registers all 5 real collectors into the sources table", async () => {
    const collectors = [
      new NvdCollector(),
      new ArxivCollector(),
      new CisaKevCollector(),
      new GithubAdvisoriesCollector(),
      new InoreaderCollector(),
    ];

    await registerSources(collectors);

    const rows = await testDb.select().from(sources);
    expect(rows).toHaveLength(5);

    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual([
      "arxiv",
      "cisa-kev",
      "github-advisories",
      "inoreader",
      "nvd",
    ]);

    for (const row of rows) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.type.length).toBeGreaterThan(0);
      expect(row.enabled).toBe(true);
    }
  });

  it("is idempotent — running registerSources twice doesn't duplicate rows", async () => {
    const collectors = [new NvdCollector()];

    await registerSources(collectors);
    await registerSources(collectors);

    const rows = await testDb
      .select()
      .from(sources)
      .where(eq(sources.id, "nvd"));
    expect(rows).toHaveLength(1);
  });
});
