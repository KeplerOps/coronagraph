import { Hono } from "hono";
import { logger } from "hono/logger";
import { getRecentItems, getItem } from "../db/queries.ts";

// Middleware
import { apiAuth, webAuth } from "./middleware/auth.ts";
import { csrfToken, csrfProtection } from "./middleware/csrf.ts";

// Web dashboard routes
import loginRoutes from "./routes/login.tsx";
import feedRoutes from "./routes/feed.tsx";
import itemRoutes from "./routes/item.tsx";
import briefsRoutes from "./routes/briefs.tsx";
import collectionsRoutes from "./routes/collections.tsx";
import settingsRoutes from "./routes/settings.tsx";

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use("*", logger());

// CSRF token generation for all routes (sets cookie + c.get("csrfToken"))
app.use("*", csrfToken);

// ---------------------------------------------------------------------------
// Health check (unauthenticated)
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Login/Logout routes (unauthenticated)
// ---------------------------------------------------------------------------

app.route("/", loginRoutes);

// ---------------------------------------------------------------------------
// API: Items (API key auth via Bearer token)
// ---------------------------------------------------------------------------

app.use("/api/*", apiAuth);

app.get("/api/items", async (c) => {
  const source = c.req.query("source");
  const type = c.req.query("type");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");

  try {
    const results = await getRecentItems({
      source,
      type,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return c.json({ data: results, count: results.length });
  } catch (err) {
    console.error("Failed to fetch items:", err);
    return c.json({ error: "Failed to fetch items" }, 500);
  }
});

app.get("/api/items/:id", async (c) => {
  const id = c.req.param("id");

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
// Web Dashboard Routes (cookie auth + CSRF protection on POST)
// ---------------------------------------------------------------------------

// Apply web auth to all dashboard routes
app.use("/", webAuth);
app.use("/items/*", webAuth);
app.use("/briefs/*", webAuth);
app.use("/collections/*", webAuth);
app.use("/settings/*", webAuth);

// Apply CSRF protection to POST requests on web routes
app.use("/items/*/annotations", csrfProtection);
app.use("/collections", csrfProtection);

app.route("/", feedRoutes);
app.route("/", itemRoutes);
app.route("/", briefsRoutes);
app.route("/", collectionsRoutes);
app.route("/", settingsRoutes);

export default app;
