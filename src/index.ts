import { getConfig } from "./config.ts";
import app from "./server/app.ts";

const config = getConfig();

const server = Bun.serve({
  port: config.PORT,
  fetch: app.fetch,
});

console.log(`Coronagraph server running on http://localhost:${server.port}`);
