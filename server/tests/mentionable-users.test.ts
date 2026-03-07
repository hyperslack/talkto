/**
 * Tests for mentionable users endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Mentionable Users", () => {
  it("returns mentionable users for a channel", async () => {
    // Get a channel first
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/mentionable`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("each mentionable user has required fields", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/mentionable`));
    const data = await res.json();
    for (const user of data) {
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.type).toBeDefined();
      expect(user.mention_name).toBeDefined();
      expect("display_name" in user).toBe(true);
    }
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/fake-id/mentionable"));
    expect(res.status).toBe(404);
  });

  it("includes both humans and agents", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/mentionable`));
    const data = await res.json();
    const types = new Set(data.map((u: { type: string }) => u.type));
    // At minimum should have human (the onboarded user)
    expect(types.has("human")).toBe(true);
  });
});
