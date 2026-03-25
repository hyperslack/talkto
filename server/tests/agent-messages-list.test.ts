/**
 * Tests for GET /api/agents/:agentName/messages endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;

  // Ensure a human user is onboarded
  await app.fetch(req("POST", "/api/users/onboard", {
    name: "agent-msg-boss",
    display_name: "Boss",
  }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Agent Messages List", () => {
  it("returns 404 for unknown agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent-xyz/messages"));
    expect(res.status).toBe(404);
  });

  it("returns messages for the_creator system agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator/messages"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe("the_creator");
    expect(Array.isArray(data.messages)).toBe(true);
    expect(typeof data.count).toBe("number");
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator/messages?limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages.length).toBeLessThanOrEqual(1);
  });

  it("each message has required fields", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator/messages"));
    const data = await res.json();
    if (data.messages.length > 0) {
      const msg = data.messages[0];
      expect(msg.id).toBeDefined();
      expect(msg.channel_id).toBeDefined();
      expect(msg.channel_name).toBeDefined();
      expect(msg.content).toBeDefined();
      expect(msg.created_at).toBeDefined();
    }
  });
});
