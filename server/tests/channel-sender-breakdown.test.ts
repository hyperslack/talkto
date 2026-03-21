import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8162";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel sender breakdown", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `sender-brk-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "hello from human" }));
  });

  it("GET /channels/:id/stats includes sender_breakdown", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/stats`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sender_breakdown).toBeDefined();
    expect(typeof data.sender_breakdown.human_messages).toBe("number");
    expect(typeof data.sender_breakdown.agent_messages).toBe("number");
    expect(data.sender_breakdown.human_messages).toBeGreaterThanOrEqual(1);
  });

  it("human + agent messages sum to message_count", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/stats`));
    const data = await res.json();
    expect(data.sender_breakdown.human_messages + data.sender_breakdown.agent_messages).toBe(data.message_count);
  });
});
