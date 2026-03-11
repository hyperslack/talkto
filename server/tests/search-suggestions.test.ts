/**
 * Tests for search suggestion endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8255";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search Suggestions", () => {
  it("records a search and retrieves recent", async () => {
    // Record searches
    await app.fetch(req("POST", "/api/search/record", { query: "hello world" }));
    await app.fetch(req("POST", "/api/search/record", { query: "test query" }));

    const res = await app.fetch(req("GET", "/api/search/suggestions/recent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it("returns popular searches", async () => {
    // Record same query multiple times
    await app.fetch(req("POST", "/api/search/record", { query: "popular term" }));
    await app.fetch(req("POST", "/api/search/record", { query: "popular term" }));

    const res = await app.fetch(req("GET", "/api/search/suggestions/popular"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("clears search history", async () => {
    const res = await app.fetch(req("DELETE", "/api/search/history"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cleared).toBeGreaterThanOrEqual(0);
  });

  it("returns empty after clearing", async () => {
    const res = await app.fetch(req("GET", "/api/search/suggestions/recent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("rejects empty query", async () => {
    const res = await app.fetch(req("POST", "/api/search/record", { query: "" }));
    expect(res.status).toBe(400);
  });
});
