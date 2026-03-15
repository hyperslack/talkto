/**
 * Tests for typing indicator endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8170";
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

describe("Typing Indicator", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `typing-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("sets typing indicator", async () => {
    const res = await app.fetch(
      req("POST", "/api/typing", { channel_id: channelId })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.typing).toBe(true);
  });

  it("shows who is typing", async () => {
    // Set typing first
    await app.fetch(req("POST", "/api/typing", { channel_id: channelId }));

    const res = await app.fetch(req("GET", `/api/typing/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
    expect(data.typing.length).toBeGreaterThanOrEqual(1);
    expect(data.typing[0].user_name).toBeDefined();
  });

  it("clears typing indicator", async () => {
    const res = await app.fetch(
      req("DELETE", "/api/typing", { channel_id: channelId })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.typing).toBe(false);
  });

  it("no one typing after clear", async () => {
    const res = await app.fetch(req("GET", `/api/typing/${channelId}`));
    const data = await res.json();
    expect(data.typing.length).toBe(0);
  });

  it("returns 400 without channel_id", async () => {
    const res = await app.fetch(req("POST", "/api/typing", {}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("POST", "/api/typing", { channel_id: "nonexistent" })
    );
    expect(res.status).toBe(404);
  });

  it("empty typing list for channel with no typists", async () => {
    const res = await app.fetch(req("GET", "/api/typing/some-other-channel"));
    const data = await res.json();
    expect(data.typing).toEqual([]);
  });
});
