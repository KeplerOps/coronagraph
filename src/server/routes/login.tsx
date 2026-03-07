import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { getConfig } from "../../config.ts";
import type { FC } from "hono/jsx";

const loginApp = new Hono();

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const LoginLayout: FC<{ error?: string }> = ({ error }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Login - Coronagraph</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </head>
    <body class="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center font-sans">
      <div class="w-full max-w-sm mx-auto px-4">
        <div class="text-center mb-8">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
            C
          </div>
          <h1 class="text-xl font-bold text-white">Coronagraph</h1>
          <p class="text-sm text-gray-500 mt-1">
            Enter your API key to continue
          </p>
        </div>

        {error && (
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            <p class="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form method="POST" action="/login" class="space-y-4">
          <div>
            <input
              type="password"
              name="api_key"
              placeholder="API Key"
              required
              autofocus
              class="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-4 py-3 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-500 hover:border-gray-600 transition-colors"
            />
          </div>
          <button
            type="submit"
            class="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </body>
  </html>
);

// ---------------------------------------------------------------------------
// GET /login
// ---------------------------------------------------------------------------

loginApp.get("/login", (c) => {
  return c.html(<LoginLayout />);
});

// ---------------------------------------------------------------------------
// POST /login - Validate API key and set auth cookie
// ---------------------------------------------------------------------------

loginApp.post("/login", async (c) => {
  const config = getConfig();
  const body = await c.req.parseBody();
  const apiKey = body["api_key"];

  if (
    !config.API_KEY ||
    typeof apiKey !== "string" ||
    apiKey !== config.API_KEY
  ) {
    return c.html(<LoginLayout error="Invalid API key" />, 401);
  }

  setCookie(c, "auth", config.API_KEY, {
    httpOnly: true,
    sameSite: "Strict",
    path: "/",
    secure: c.req.url.startsWith("https"),
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return c.redirect("/");
});

// ---------------------------------------------------------------------------
// GET /logout - Clear auth cookie and redirect to login
// ---------------------------------------------------------------------------

loginApp.get("/logout", (c) => {
  deleteCookie(c, "auth", { path: "/" });
  return c.redirect("/login");
});

export default loginApp;
