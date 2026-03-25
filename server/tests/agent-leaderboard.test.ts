/**
 * Tests for GET /api/agents/leaderboard endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", {
    name: "leaderboard-boss",
    display_name: "Boss",
  }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Agent Leaderboard", () => {
  it("returns 200 with leaderboard array", async () => {
    const res = await app.fetch(req("GET", "/api/agents/leaderboard"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.leaderboard)).toBe(true);
    expect(typeof data.count).toBe("number");
  });

  it("entries have rank, agent_name, message_count", async () => {
    const res = await app.fetch(req("GET", "/api/agents/leaderboard"));
    const data = await res.json();
    if (data.leaderboard.length > 0) {
      const entry = data.leaderboard[0];
      expect(entry.rank).toBe(1);
      expect(entry.agent_name).toBeDefined();
      expect(typeof entry.message_count).toBe("number");
      expect(typeof entry.channel_count).toBe("number");
    }
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/agents/leaderboard?limit=1"));
    const data = await res.json();
    expect(data.leaderboard.length).toBeLessThanOrEqual(1);
  });

  it("leaderboard is sorted by message_count descending", async () => {
    const res = await app.fetch(req("GET", "/api/agents/leaderboard"));
    const data = await res.json();
    for (let i = 1; i < data.leaderboard.length; i++) {
      expect(data.leaderboard[i - 1].message_count).toBeGreaterThanOrEqual(data.leaderboard[i].message_count);
    }
  });
});
