/**
 * Tests for workspace audit log.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8133";
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

describe("Audit Log", () => {
  it("GET /api/audit returns 200 with array", async () => {
    const res = await app.fetch(req("GET", "/api/audit"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("channel creation generates audit entry", async () => {
    const channelName = `audit-test-${Date.now()}`;
    await app.fetch(req("POST", "/api/channels", { name: channelName }));

    const res = await app.fetch(req("GET", "/api/audit?action=channel.create"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    const entry = data.find((e: Record<string, unknown>) =>
      e.metadata && (e.metadata as Record<string, unknown>).name === `#${channelName}`
    );
    expect(entry).toBeDefined();
    expect(entry.action).toBe("channel.create");
    expect(entry.target_type).toBe("channel");
  });

  it("supports action filter", async () => {
    const res = await app.fetch(req("GET", "/api/audit?action=nonexistent.action"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("supports limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/audit?limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(1);
  });

  it("audit entries have expected fields", async () => {
    const res = await app.fetch(req("GET", "/api/audit?limit=1"));
    const data = await res.json();
    if (data.length > 0) {
      const entry = data[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("action");
      expect(entry).toHaveProperty("created_at");
    }
  });
});
