/**
 * Tests for daily message activity endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Daily Activity", () => {
  it("GET /api/activity/daily returns activity array", async () => {
    const res = await app.fetch(req("GET", "/api/activity/daily"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.days).toBe("number");
    expect(Array.isArray(data.activity)).toBe(true);
  });

  it("each entry has date and message_count", async () => {
    const res = await app.fetch(req("GET", "/api/activity/daily"));
    const data = await res.json();
    for (const entry of data.activity) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.message_count).toBe("number");
      expect(entry.message_count).toBeGreaterThan(0);
    }
  });

  it("respects days parameter", async () => {
    const res = await app.fetch(req("GET", "/api/activity/daily?days=7"));
    const data = await res.json();
    expect(data.days).toBe(7);
  });

  it("caps days at 365", async () => {
    const res = await app.fetch(req("GET", "/api/activity/daily?days=9999"));
    const data = await res.json();
    expect(data.days).toBe(365);
  });
});
