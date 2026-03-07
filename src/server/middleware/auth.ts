import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { getConfig } from "../../config.ts";

/**
 * API key authentication middleware for /api/* routes.
 * Checks for Authorization: Bearer <key> header.
 * If API_KEY is not configured, skips auth (graceful degradation).
 */
export const apiAuth = createMiddleware(async (c, next) => {
  const config = getConfig();

  // Graceful degradation: skip auth when API_KEY is not set
  if (!config.API_KEY) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice("Bearer ".length);
  if (token !== config.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
});

/**
 * Web dashboard authentication middleware.
 * Checks for a valid auth cookie.
 * If API_KEY is not configured, skips auth (graceful degradation).
 * Redirects to /login if not authenticated.
 */
export const webAuth = createMiddleware(async (c, next) => {
  const config = getConfig();

  // Graceful degradation: skip auth when API_KEY is not set
  if (!config.API_KEY) {
    return next();
  }

  const authCookie = getCookie(c, "auth");
  if (!authCookie || authCookie !== config.API_KEY) {
    return c.redirect("/login");
  }

  return next();
});
