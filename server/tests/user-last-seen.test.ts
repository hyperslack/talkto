/**
 * Tests for user last-seen tracking endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8187";
  const mod = await import("../src/index");
  app = mod.app;

  await app.fetch(
    new Request("http://localhost/api/users/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "lastseen-user" }),
    })
  );
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("User Last Seen", () => {
  it("last_seen starts as null", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/last-seen"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.last_seen_at).toBeNull();
  });

  it("heartbeat updates last_seen_at", async () => {
    const res = await app.fetch(req("POST", "/api/users/me/heartbeat"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.last_seen_at).toBeDefined();
    expect(typeof data.last_seen_at).toBe("string");
  });

  it("last_seen reflects heartbeat", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/last-seen"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.last_seen_at).toBeDefined();
    expect(data.user_id).toBeDefined();
  });

  it("heartbeat updates timestamp on each call", async () => {
    const res1 = await app.fetch(req("POST", "/api/users/me/heartbeat"));
    const d1 = await res1.json();

    // Small delay
    await new Promise((r) => setTimeout(r, 10));

    const res2 = await app.fetch(req("POST", "/api/users/me/heartbeat"));
    const d2 = await res2.json();

    expect(d2.last_seen_at >= d1.last_seen_at).toBe(true);
  });
});
