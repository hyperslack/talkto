import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8164";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Message content validation", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `msg-val-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;
  });

  it("rejects whitespace-only content", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "   \n  " }));
    expect(res.status).toBe(400);
  });

  it("trims content before storing", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "  hello  " }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.content).toBe("hello");
  });

  it("rejects content over 4000 chars", async () => {
    const longContent = "a".repeat(4001);
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: longContent }));
    expect(res.status).toBe(400);
  });

  it("accepts content at exactly 4000 chars", async () => {
    const content = "b".repeat(4000);
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content }));
    expect(res.status).toBe(201);
  });
});
