/**
 * Tests for GET /api/users/me/reaction-stats
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;
let generalId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "urs-test-user", display_name: "URS" }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  generalId = channels.find((c: any) => c.name === "#general").id;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("User Reaction Stats", () => {
  it("returns empty stats when no reactions given", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reaction-stats"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_reactions).toBe(0);
    expect(data.unique_emojis).toBe(0);
    expect(data.emoji_breakdown).toEqual([]);
  });

  it("tracks reactions after reacting", async () => {
    // Post a message then react
    const msgRes = await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
      content: "urs reaction test unique-urs-1",
    }));
    const msg = await msgRes.json();

    await app.fetch(req("POST", `/api/channels/${generalId}/messages/${msg.id}/react`, {
      emoji: "👍",
    }));

    const res = await app.fetch(req("GET", "/api/users/me/reaction-stats"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_reactions).toBeGreaterThanOrEqual(1);
    expect(data.unique_emojis).toBeGreaterThanOrEqual(1);
    expect(data.emoji_breakdown.length).toBeGreaterThanOrEqual(1);
  });

  it("emoji_breakdown includes emoji and count fields", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reaction-stats"));
    const data = await res.json();
    if (data.emoji_breakdown.length > 0) {
      expect(data.emoji_breakdown[0].emoji).toBeDefined();
      expect(data.emoji_breakdown[0].count).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns user_id in response", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reaction-stats"));
    const data = await res.json();
    expect(data.user_id).toBeDefined();
  });
});
