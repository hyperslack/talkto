import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8166";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Duplicate message prevention", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `dup-msg-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;
  });

  it("returns 409 for duplicate message within 5 seconds", async () => {
    const content = `dup-test-${Date.now()}`;
    const res1 = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content }));
    expect(res1.status).toBe(201);

    const res2 = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content }));
    expect(res2.status).toBe(409);
    const data = await res2.json();
    expect(data.detail).toContain("Duplicate");
  });

  it("allows different content from same sender", async () => {
    const res1 = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: `unique-a-${Date.now()}` }));
    expect(res1.status).toBe(201);

    const res2 = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: `unique-b-${Date.now()}` }));
    expect(res2.status).toBe(201);
  });
});
