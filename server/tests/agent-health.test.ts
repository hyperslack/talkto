/**
 * Tests for agent health summary endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8137";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, { method });
}

describe("Agent Health Summary", () => {
  it("returns health summary with counts", async () => {
    const res = await app.fetch(req("GET", "/api/agents/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe("number");
    expect(typeof data.online).toBe("number");
    expect(typeof data.offline).toBe("number");
    expect(typeof data.ghost).toBe("number");
    expect(data.total).toBe(data.online + data.offline + data.ghost);
  });

  it("includes agent details", async () => {
    const res = await app.fetch(req("GET", "/api/agents/health"));
    const data = await res.json();
    expect(Array.isArray(data.agents)).toBe(true);
    if (data.agents.length > 0) {
      const agent = data.agents[0];
      expect(agent).toHaveProperty("agent_name");
      expect(agent).toHaveProperty("status");
      expect(agent).toHaveProperty("is_ghost");
    }
  });

  it("total matches agents array length", async () => {
    const res = await app.fetch(req("GET", "/api/agents/health"));
    const data = await res.json();
    expect(data.total).toBe(data.agents.length);
  });
});
