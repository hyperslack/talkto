/**
 * Tests for starred channels endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8167";
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

describe("Starred Channels", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `starred-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("initially has no starred channels", async () => {
    const res = await app.fetch(req("GET", "/api/starred-channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("stars a channel", async () => {
    const res = await app.fetch(req("POST", `/api/starred-channels/${channelId}`));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.starred).toBe(true);
  });

  it("rejects duplicate star", async () => {
    const res = await app.fetch(req("POST", `/api/starred-channels/${channelId}`));
    expect(res.status).toBe(409);
  });

  it("lists starred channels", async () => {
    const res = await app.fetch(req("GET", "/api/starred-channels"));
    const data = await res.json();
    const found = data.find((c: any) => c.id === channelId);
    expect(found).toBeDefined();
    expect(found.name).toBeDefined();
  });

  it("returns 404 when starring nonexistent channel", async () => {
    const res = await app.fetch(req("POST", "/api/starred-channels/nonexistent"));
    expect(res.status).toBe(404);
  });

  it("unstars a channel", async () => {
    const res = await app.fetch(req("DELETE", `/api/starred-channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starred).toBe(false);
  });

  it("returns 404 when unstarring non-starred channel", async () => {
    const res = await app.fetch(req("DELETE", `/api/starred-channels/${channelId}`));
    expect(res.status).toBe(404);
  });
});
