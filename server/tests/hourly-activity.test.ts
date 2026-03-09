/**
 * Tests for GET /api/activity/hourly endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8202";
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

describe("Hourly Activity", () => {
  beforeAll(async () => {
    // Create a channel and post messages
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `hourly-test-${Date.now()}` })
    );
    const ch = await res.json();
    await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "test msg 1" })
    );
    await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "test msg 2" })
    );
  });

  it("returns 24 hours of activity data", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activity).toHaveLength(24);
    expect(data.activity[0].hour).toBe(0);
    expect(data.activity[23].hour).toBe(23);
  });

  it("includes message counts", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly"));
    const data = await res.json();
    const total = data.activity.reduce((sum: number, h: { message_count: number }) => sum + h.message_count, 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it("respects days parameter", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly?days=7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.days).toBe(7);
    expect(data.activity).toHaveLength(24);
  });

  it("caps days at 365", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly?days=999"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.days).toBe(365);
  });

  it("each entry has hour and message_count fields", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly"));
    const data = await res.json();
    for (const entry of data.activity) {
      expect(typeof entry.hour).toBe("number");
      expect(typeof entry.message_count).toBe("number");
      expect(entry.hour).toBeGreaterThanOrEqual(0);
      expect(entry.hour).toBeLessThanOrEqual(23);
    }
  });
});
