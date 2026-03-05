/**
 * Tests for agent task update endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
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

describe("Agent Task Update", () => {
  let agentName: string;

  beforeAll(async () => {
    const res = await app.fetch(req("GET", "/api/agents"));
    const agents = await res.json();
    if (agents.length > 0) {
      agentName = agents[0].agent_name;
    }
  });

  it("updates agent current_task", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PATCH", `/api/agents/${agentName}/task`, {
        current_task: "Fixing bug #42",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.current_task).toBe("Fixing bug #42");
  });

  it("clears task with null", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PATCH", `/api/agents/${agentName}/task`, {
        current_task: null,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.current_task).toBeNull();
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/agents/nonexistent-agent/task", {
        current_task: "test",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when current_task is missing", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PATCH", `/api/agents/${agentName}/task`, {})
    );
    expect(res.status).toBe(400);
  });

  it("rejects overly long task", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PATCH", `/api/agents/${agentName}/task`, {
        current_task: "x".repeat(501),
      })
    );
    expect(res.status).toBe(400);
  });
});
