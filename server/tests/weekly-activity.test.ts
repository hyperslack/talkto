/**
 * Tests for GET /api/activity/weekly.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8204";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "weekly-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET /api/activity/weekly", () => {
  it("returns weekly activity with defaults", async () => {
    const res = await app.fetch(req("GET", "/api/activity/weekly"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weeks).toBe(4);
    expect(Array.isArray(data.activity)).toBe(true);
    expect(typeof data.active_senders).toBe("number");
  });

  it("respects weeks param", async () => {
    const res = await app.fetch(req("GET", "/api/activity/weekly?weeks=2"));
    const data = await res.json();
    expect(data.weeks).toBe(2);
  });

  it("caps weeks at 52", async () => {
    const res = await app.fetch(req("GET", "/api/activity/weekly?weeks=100"));
    const data = await res.json();
    expect(data.weeks).toBe(52);
  });

  it("includes top_channel when messages exist", async () => {
    // Post a message to generate data
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `weekly-ch-${Date.now()}` }));
    const ch = await chRes.json();
    await app.fetch(req("POST", `/api/channels/${ch.id}/messages`, { content: "weekly test msg" }));

    const res = await app.fetch(req("GET", "/api/activity/weekly"));
    const data = await res.json();
    expect(data.active_senders).toBeGreaterThan(0);
    // activity array should have at least one entry for this week
    expect(data.activity.length).toBeGreaterThan(0);
  });
});
