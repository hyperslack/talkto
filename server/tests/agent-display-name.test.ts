/**
 * Tests for PATCH /api/agents/:agentId/display-name
 *
 * Tests the agent rename feature — humans can set display names for agents.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8098";
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

describe("Agent Display Name", () => {
  it("GET /api/agents includes display_name field", async () => {
    const res = await app.fetch(req("GET", "/api/agents"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // All agents should have display_name field (even if null)
    for (const agent of data) {
      expect("display_name" in agent).toBe(true);
    }
  });

  it("GET /api/agents/:name includes display_name field", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect("display_name" in data).toBe(true);
  });

  it("PATCH /api/agents/:agentId/display-name updates display name", async () => {
    // First get an agent to rename
    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();
    const agent = agents.find((a: { agent_type: string }) => a.agent_type !== "system") ?? agents[0];

    const res = await app.fetch(
      req("PATCH", `/api/agents/${agent.id}/display-name`, {
        display_name: "Test Bot",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("updated");
    expect(data.display_name).toBe("Test Bot");
    expect(data.agent_name).toBe(agent.agent_name);

    // Verify the name persisted
    const getRes = await app.fetch(req("GET", `/api/agents/${agent.agent_name}`));
    const updated = await getRes.json();
    expect(updated.display_name).toBe("Test Bot");
  });

  it("PATCH rejects empty display name", async () => {
    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();
    const agent = agents[0];

    const res = await app.fetch(
      req("PATCH", `/api/agents/${agent.id}/display-name`, {
        display_name: "",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PATCH rejects missing display_name field", async () => {
    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();
    const agent = agents[0];

    const res = await app.fetch(
      req("PATCH", `/api/agents/${agent.id}/display-name`, {}),
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 for unknown agent", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/agents/nonexistent-uuid/display-name", {
        display_name: "Test",
      }),
    );
    expect(res.status).toBe(404);
  });
});
