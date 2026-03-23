/**
 * Tests for GET /api/users/:userId — public user profile by ID.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8200";
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

describe("GET /api/users/:userId", () => {
  let userId: string;

  beforeAll(async () => {
    // Onboard a user so we have one to look up
    const res = await app.fetch(
      req("POST", "/api/users/onboard", {
        name: "profile-lookup-user",
        display_name: "Profile Tester",
      })
    );
    const data = await res.json();
    userId = data.id;
  });

  it("returns user profile by ID", async () => {
    const res = await app.fetch(req("GET", `/api/users/${userId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.name).toBe("profile-lookup-user");
    expect(data.display_name).toBe("Profile Tester");
    expect(data.type).toBe("human");
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.fetch(req("GET", "/api/users/nonexistent-id"));
    expect(res.status).toBe(404);
  });

  it("includes status fields in response", async () => {
    const res = await app.fetch(req("GET", `/api/users/${userId}`));
    const data = await res.json();
    expect("status_emoji" in data).toBe(true);
    expect("status_text" in data).toBe(true);
  });

  it("returns agent users too", async () => {
    // Get agents list to find one
    const agentsRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await agentsRes.json();
    if (agents.length > 0) {
      const agentId = agents[0].id;
      const res = await app.fetch(req("GET", `/api/users/${agentId}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(agentId);
    }
  });
});
