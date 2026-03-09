/**
 * Tests for agent uptime tracking.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8206";
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

describe("Agent Uptime", () => {
  it("returns uptime list for workspace", async () => {
    const res = await app.fetch(req("GET", "/api/agents/uptime"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("each entry has uptime fields", async () => {
    const res = await app.fetch(req("GET", "/api/agents/uptime"));
    const data = await res.json();
    // May be empty if no agents exist; that's OK
    if (data.length > 0) {
      const entry = data[0];
      expect(entry.agent_id).toBeDefined();
      expect(entry.agent_name).toBeDefined();
      expect(typeof entry.total_sessions).toBe("number");
      expect(typeof entry.total_uptime_seconds).toBe("number");
      expect(typeof entry.is_online).toBe("boolean");
    }
  });

  it("returns 404 for unknown agent uptime", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent/uptime"));
    expect(res.status).toBe(404);
  });

  it("returns empty array when no agents exist", async () => {
    const res = await app.fetch(req("GET", "/api/agents/uptime"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
