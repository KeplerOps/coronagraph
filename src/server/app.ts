import { Hono } from "hono";
import { logger } from "hono/logger";
import { getItem, getRecentItems } from "../db/queries.ts";
import briefsRoutes from "./routes/briefs.tsx";
import collectionsRoutes from "./routes/collections.tsx";
// Web dashboard routes
import feedRoutes from "./routes/feed.tsx";
import itemRoutes from "./routes/item.tsx";
import settingsRoutes from "./routes/settings.tsx";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use("*", logger());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API: Items
// ---------------------------------------------------------------------------

app.get("/api/items", async (c) => {
  const source = c.req.query("source");
  const type = c.req.query("type");
  const limitRaw = parseInt(c.req.query("limit") ?? "", 10);
  const offsetRaw = parseInt(c.req.query("offset") ?? "", 10);
  const limit = Math.min(
    Number.isNaN(limitRaw) ? 50 : Math.max(0, limitRaw),
    200,
  );
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

  try {
    const results = await getRecentItems({
      source,
      type,
      limit,
      offset,
    });

    return c.json({ data: results, count: results.length });
  } catch (err) {
    console.error("Failed to fetch items:", err);
    return c.json({ error: "Failed to fetch items" }, 500);
  }
});

app.get("/api/items/:id", async (c) => {
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) {
    return c.json({ error: "Invalid item ID" }, 400);
  }

  try {
    const item = await getItem(id);

    if (!item) {
      return c.json({ error: "Item not found" }, 404);
    }

    return c.json({ data: item });
  } catch (err) {
    console.error("Failed to fetch item:", err);
    return c.json({ error: "Failed to fetch item" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Web Dashboard Routes
// ---------------------------------------------------------------------------

app.route("/", feedRoutes);
app.route("/", itemRoutes);
app.route("/", briefsRoutes);
app.route("/", collectionsRoutes);
app.route("/", settingsRoutes);

export default app;
