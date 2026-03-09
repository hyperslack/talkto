/**
 * Tests for GET /api/activity/by-sender-type endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8207";
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

describe("Activity By Sender Type", () => {
  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `sender-type-${Date.now()}` })
    );
    const ch = await res.json();
    await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "human message" })
    );
  });

  it("returns sender type breakdown", async () => {
    const res = await app.fetch(req("GET", "/api/activity/by-sender-type"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.human_messages).toBe("number");
    expect(typeof data.agent_messages).toBe("number");
    expect(typeof data.total).toBe("number");
    expect(typeof data.agent_ratio).toBe("number");
  });

  it("includes human messages from test setup", async () => {
    const res = await app.fetch(req("GET", "/api/activity/by-sender-type"));
    const data = await res.json();
    expect(data.human_messages).toBeGreaterThanOrEqual(1);
    expect(data.total).toBe(data.human_messages + data.agent_messages);
  });

  it("respects days parameter", async () => {
    const res = await app.fetch(req("GET", "/api/activity/by-sender-type?days=7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.days).toBe(7);
  });

  it("agent_ratio is between 0 and 1", async () => {
    const res = await app.fetch(req("GET", "/api/activity/by-sender-type"));
    const data = await res.json();
    expect(data.agent_ratio).toBeGreaterThanOrEqual(0);
    expect(data.agent_ratio).toBeLessThanOrEqual(1);
  });
});
