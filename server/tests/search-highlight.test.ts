/**
 * Tests for search result highlighting.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8205";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search Highlight", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `highlight-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;

    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Hello world, this is a test message" })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Another test with HELLO uppercase" })
    );
  });

  it("includes content_highlighted in search results", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=Hello"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const result = data.results[0];
    expect(result.content_highlighted).toBeDefined();
    expect(result.content_highlighted).toContain("<mark>");
  });

  it("highlights case-insensitively", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=hello"));
    const data = await res.json();
    // Should find both "Hello" and "HELLO"
    expect(data.results.length).toBeGreaterThanOrEqual(2);
    for (const result of data.results) {
      expect(result.content_highlighted).toContain("<mark>");
    }
  });

  it("preserves original content unchanged", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=test"));
    const data = await res.json();
    const result = data.results[0];
    expect(result.content).not.toContain("<mark>");
    expect(result.content_highlighted).toContain("<mark>test</mark>");
  });

  it("wraps each occurrence separately", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=test"));
    const data = await res.json();
    const result = data.results.find((r: { content: string }) => r.content.includes("test message"));
    expect(result.content_highlighted).toBe("Hello world, this is a <mark>test</mark> message");
  });
});
