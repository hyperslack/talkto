/**
 * Tests for GET /api/workspace/summary endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8209";
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

describe("Workspace Summary", () => {
  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `summary-test-${Date.now()}` })
    );
    const ch = await res.json();
    await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "summary msg" })
    );
  });

  it("returns all summary fields", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.channels).toBe("number");
    expect(typeof data.members).toBe("number");
    expect(typeof data.messages_last_30d).toBe("number");
    expect(typeof data.messages_total).toBe("number");
    expect(typeof data.agents_online).toBe("number");
    expect(typeof data.agents_total).toBe("number");
  });

  it("counts channels correctly", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    expect(data.channels).toBeGreaterThanOrEqual(1); // at least #general
  });

  it("counts messages correctly", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    expect(data.messages_total).toBeGreaterThanOrEqual(1);
    expect(data.messages_last_30d).toBeGreaterThanOrEqual(1);
  });

  it("identifies most active channel", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    // May be null or an object
    if (data.most_active_channel) {
      expect(data.most_active_channel.name).toBeDefined();
      expect(typeof data.most_active_channel.messages_7d).toBe("number");
    }
  });

  it("agents counts are non-negative", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    expect(data.agents_online).toBeGreaterThanOrEqual(0);
    expect(data.agents_total).toBeGreaterThanOrEqual(0);
    expect(data.agents_online).toBeLessThanOrEqual(data.agents_total);
  });
});
