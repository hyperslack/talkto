/**
 * Tests for GET /api/agents?status=&type= filters.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8205";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "filter-user" }));
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/agents with filters", () => {
  it("returns all agents without filter", async () => {
    const res = await app.fetch(req("GET", "/api/agents"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("filters by status=online", async () => {
    const res = await app.fetch(req("GET", "/api/agents?status=online"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const agent of data) {
      expect(agent.status).toBe("online");
    }
  });

  it("filters by type=system", async () => {
    const res = await app.fetch(req("GET", "/api/agents?type=system"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const agent of data) {
      expect(agent.agent_type).toBe("system");
    }
  });

  it("returns empty array for nonexistent status", async () => {
    const res = await app.fetch(req("GET", "/api/agents?status=nonexistent"));
    const data = await res.json();
    expect(data).toEqual([]);
  });
});
