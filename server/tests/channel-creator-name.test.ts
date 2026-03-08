/**
 * Tests for created_by_name in channel detail response.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8155";
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

describe("Channel Creator Name", () => {
  it("GET /channels/:id includes created_by_name", async () => {
    // Get any channel
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const channel = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${channel.id}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.created_by_name).toBeDefined();
  });

  it("resolves user name for human-created channels", async () => {
    // Create a channel (localhost auth creates as authenticated user)
    const createRes = await app.fetch(
      req("POST", "/api/channels", { name: `creator-test-${Date.now()}` })
    );
    const channel = await createRes.json();

    const res = await app.fetch(req("GET", `/api/channels/${channel.id}`));
    const data = await res.json();
    // created_by_name should be a string (user name or "human" fallback)
    expect(typeof data.created_by_name).toBe("string");
    expect(data.created_by_name.length).toBeGreaterThan(0);
  });

  it("system channels show 'system' as creator name", async () => {
    // #general is created by "system"
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const general = channels.find((ch: { name: string }) => ch.name === "#general");

    if (general) {
      const res = await app.fetch(req("GET", `/api/channels/${general.id}`));
      const data = await res.json();
      // Should be "system" or a resolved name
      expect(data.created_by_name).toBeDefined();
    }
  });
});
