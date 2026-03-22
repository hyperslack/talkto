/**
 * Tests for PATCH /api/agents/:agentName/description
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";
import { eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID } from "../src/db";
import { users, agents } from "../src/db/schema";

let app: any;
const AGENT_NAME = "desc-test-agent";

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "desc-test-user" }));

  // Create a test agent
  const db = getDb();
  const agentUserId = crypto.randomUUID();
  db.insert(users).values({
    id: agentUserId,
    name: AGENT_NAME,
    type: "agent",
    createdAt: new Date().toISOString(),
  }).run();
  db.insert(agents).values({
    id: agentUserId,
    agentName: AGENT_NAME,
    agentType: "claude",
    projectPath: "/tmp/test",
    projectName: "test",
    status: "online",
    workspaceId: DEFAULT_WORKSPACE_ID,
  }).run();
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Agent Description Update", () => {
  it("sets description successfully", async () => {
    const res = await app.fetch(req("PATCH", `/api/agents/${AGENT_NAME}/description`, {
      description: "A helpful coding assistant",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe(AGENT_NAME);
    expect(data.description).toBe("A helpful coding assistant");
  });

  it("clears description with null", async () => {
    const res = await app.fetch(req("PATCH", `/api/agents/${AGENT_NAME}/description`, {
      description: null,
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("returns 404 for unknown agent", async () => {
    const res = await app.fetch(req("PATCH", "/api/agents/nonexistent-agent/description", {
      description: "test",
    }));
    expect(res.status).toBe(404);
  });

  it("rejects description over 2000 chars", async () => {
    const res = await app.fetch(req("PATCH", `/api/agents/${AGENT_NAME}/description`, {
      description: "x".repeat(2001),
    }));
    expect(res.status).toBe(400);
  });
});
