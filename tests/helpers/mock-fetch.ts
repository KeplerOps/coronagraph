import { spyOn } from "bun:test";

/**
 * Mock globalThis.fetch to return a JSON response.
 *
 * @param data  The object to return as JSON
 * @param status  HTTP status code (default 200)
 * @returns The spy instance for assertions
 */
export function mockFetchJson(data: unknown, status = 200) {
  const spy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  return spy;
}

/**
 * Mock globalThis.fetch to return a text/XML response.
 *
 * @param text  The string body to return
 * @param status  HTTP status code (default 200)
 * @param contentType  Content-Type header (default "text/plain")
 * @returns The spy instance for assertions
 */
export function mockFetchText(text: string, status = 200, contentType = "text/plain") {
  const spy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(text, {
      status,
      headers: { "Content-Type": contentType },
    }),
  );
  return spy;
}

/**
 * Set up a fetch spy that can be configured per-call.
 * Returns an object with the spy and a restore function.
 *
 * Usage:
 *   const { spy, restore } = setupFetchSpy();
 *   spy.mockResolvedValueOnce(new Response(...));
 *   // ... run code ...
 *   restore();
 */
export function setupFetchSpy() {
  const original = globalThis.fetch;
  const spy = spyOn(globalThis, "fetch");

  return {
    spy,
    restore() {
      spy.mockRestore();
      globalThis.fetch = original;
    },
  };
}
