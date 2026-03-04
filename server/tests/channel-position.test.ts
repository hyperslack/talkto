/**
 * Tests for channel position/ordering.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8138";
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

describe("Channel Position", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    channelId = channels[0].id;
  });

  it("channels have position field", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("position");
  });

  it("sets position on a channel", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/position`, { position: 5 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.position).toBe(5);
  });

  it("rejects negative position", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/position`, { position: -1 })
    );
    expect(res.status).toBe(400);
  });

  it("bulk reorders channels", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    if (channels.length < 2) return;

    const order = channels.slice(0, 2).map((ch: { id: string }, i: number) => ({
      channel_id: ch.id,
      position: (channels.length - i),
    }));

    const res = await app.fetch(req("PUT", "/api/channels/reorder", { order }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated).toBe(2);
  });

  it("channel list is sorted by position", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    // Verify positions are in non-decreasing order
    for (let i = 1; i < channels.length; i++) {
      const prevPos = channels[i-1].position ?? 0;
      const currPos = channels[i].position ?? 0;
      if (prevPos !== currPos) {
        expect(prevPos).toBeLessThanOrEqual(currPos);
      }
    }
  });
});
