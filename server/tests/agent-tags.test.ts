/**
 * Tests for agent capability tags.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;
let agentName: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8134";
  const mod = await import("../src/index");
  app = mod.app;

  // Get first agent
  const res = await app.fetch(new Request("http://localhost/api/agents", { method: "GET" }));
  const agents = await res.json();
  if (agents.length > 0) agentName = agents[0].agent_name;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Agent Capability Tags", () => {
  it("returns empty tags for agent", async () => {
    if (!agentName) return;
    const res = await app.fetch(req("GET", `/api/agents/${agentName}/tags`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe(agentName);
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it("sets tags on an agent", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PUT", `/api/agents/${agentName}/tags`, { tags: ["code-review", "testing", "frontend"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toContain("code-review");
    expect(data.tags).toContain("testing");
    expect(data.tags).toContain("frontend");
  });

  it("reads tags back", async () => {
    if (!agentName) return;
    const res = await app.fetch(req("GET", `/api/agents/${agentName}/tags`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags.length).toBe(3);
  });

  it("replaces tags", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PUT", `/api/agents/${agentName}/tags`, { tags: ["devops"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toEqual(["devops"]);
  });

  it("searches agents by tag", async () => {
    if (!agentName) return;
    const res = await app.fetch(req("GET", "/api/agents/tags/search?tag=devops"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tag).toBe("devops");
    expect(data.agents.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent/tags"));
    expect(res.status).toBe(404);
  });

  it("rejects invalid tags payload", async () => {
    if (!agentName) return;
    const res = await app.fetch(
      req("PUT", `/api/agents/${agentName}/tags`, { tags: "not-an-array" })
    );
    expect(res.status).toBe(400);
  });
});
