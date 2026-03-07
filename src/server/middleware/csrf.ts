import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";

/**
 * Generates a random CSRF token.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensures a CSRF token cookie exists. If not, generates one and sets it.
 * Makes the token available via c.get("csrfToken").
 */
export const csrfToken = createMiddleware(async (c, next) => {
  let token = getCookie(c, "csrf_token");

  if (!token) {
    token = generateCsrfToken();
    setCookie(c, "csrf_token", token, {
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
      secure: c.req.url.startsWith("https"),
    });
  }

  c.set("csrfToken", token);
  return next();
});

/**
 * Validates CSRF token on POST requests.
 * Checks that the _csrf field in the form body matches the csrf_token cookie.
 */
export const csrfProtection = createMiddleware(async (c, next) => {
  if (c.req.method !== "POST") {
    return next();
  }

  const cookieToken = getCookie(c, "csrf_token");
  if (!cookieToken) {
    return c.html("<p>CSRF validation failed</p>", 403);
  }

  // Clone the request so we can read the body without consuming it
  const contentType = c.req.header("content-type") || "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const body = await c.req.parseBody();
    const formToken = body["_csrf"];

    if (typeof formToken !== "string" || formToken !== cookieToken) {
      return c.html("<p>CSRF validation failed</p>", 403);
    }
  }

  return next();
});
