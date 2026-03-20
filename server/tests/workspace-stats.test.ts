/**
 * Tests for GET /api/stats workspace overview endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8188";
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

describe("Workspace Stats", () => {
  let channelId: string;

  beforeAll(async () => {
    await app.fetch(req("POST", "/api/users/onboard", { name: "stats-user" }));

    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `stats-ch-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    for (let i = 0; i < 3; i++) {
      await app.fetch(
        req("POST", `/api/channels/${channelId}/messages`, { content: `stat msg ${i}` })
      );
    }
  });

  it("returns stats object", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total_messages).toBe("number");
    expect(typeof data.total_channels).toBe("number");
    expect(typeof data.active_users).toBe("number");
    expect(typeof data.messages_last_24h).toBe("number");
  });

  it("total_messages includes posted messages", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    const data = await res.json();
    expect(data.total_messages).toBeGreaterThanOrEqual(3);
  });

  it("messages_last_24h counts recent messages", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    const data = await res.json();
    expect(data.messages_last_24h).toBeGreaterThanOrEqual(3);
  });

  it("most_active_channel is populated", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    const data = await res.json();
    expect(data.most_active_channel).toBeDefined();
    expect(data.most_active_channel.name).toBeDefined();
    expect(data.most_active_channel.message_count).toBeGreaterThan(0);
  });

  it("active_users counts unique senders", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    const data = await res.json();
    expect(data.active_users).toBeGreaterThanOrEqual(1);
  });

  it("total_channels is non-negative", async () => {
    const res = await app.fetch(req("GET", "/api/stats"));
    const data = await res.json();
    expect(data.total_channels).toBeGreaterThanOrEqual(1);
  });
});
