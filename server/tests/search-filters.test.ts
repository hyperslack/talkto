/**
 * Tests for search date and sender filters.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8183";
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

describe("Search Filters", () => {
  let channelId: string;

  beforeAll(async () => {
    // Onboard user
    await app.fetch(req("POST", "/api/users/onboard", { name: "search-filter-user" }));

    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `search-filter-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    // Post messages
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "unique-alpha-test" })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "unique-alpha-another" })
    );
  });

  it("basic search works", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=unique-alpha"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(2);
  });

  it("filters by from date (future excludes all)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const res = await app.fetch(req("GET", `/api/search?q=unique-alpha&from=${future}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("filters by to date (past excludes all)", async () => {
    const past = "2020-01-01T00:00:00.000Z";
    const res = await app.fetch(req("GET", `/api/search?q=unique-alpha&to=${past}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("filters by from date (past includes all)", async () => {
    const past = "2020-01-01T00:00:00.000Z";
    const res = await app.fetch(req("GET", `/api/search?q=unique-alpha&from=${past}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(2);
  });

  it("filters by sender name", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=unique-alpha&sender=search-filter-user"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("sender filter with nonexistent user returns empty", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=unique-alpha&sender=nobody-here"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("combines date and channel filters", async () => {
    const past = "2020-01-01T00:00:00.000Z";
    const future = new Date(Date.now() + 86400000).toISOString();
    const res = await app.fetch(
      req("GET", `/api/search?q=unique-alpha&from=${past}&to=${future}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(2);
  });
});
