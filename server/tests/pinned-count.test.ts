/**
 * Tests for pinned_count in channel list response.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8154";
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

describe("Pinned Count in Channel Response", () => {
  it("channels include pinned_count field", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const channels = await res.json();
    expect(channels.length).toBeGreaterThan(0);
    for (const ch of channels) {
      expect(typeof ch.pinned_count).toBe("number");
    }
  });

  it("pinned_count is 0 for channel with no pins", async () => {
    const createRes = await app.fetch(
      req("POST", "/api/channels", { name: `pincount-${Date.now()}` })
    );
    const channel = await createRes.json();

    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const found = channels.find((ch: { id: string }) => ch.id === channel.id);
    expect(found.pinned_count).toBe(0);
  });

  it("pinned_count reflects pinned messages", async () => {
    const createRes = await app.fetch(
      req("POST", "/api/channels", { name: `pincount2-${Date.now()}` })
    );
    const channel = await createRes.json();

    // Send a message
    const msgRes = await app.fetch(
      req("POST", `/api/channels/${channel.id}/messages`, { content: "pin me" })
    );
    const msg = await msgRes.json();

    // Pin it
    await app.fetch(req("POST", `/api/channels/${channel.id}/messages/${msg.id}/pin`));

    // Check count
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const found = channels.find((ch: { id: string }) => ch.id === channel.id);
    expect(found.pinned_count).toBe(1);
  });
});
