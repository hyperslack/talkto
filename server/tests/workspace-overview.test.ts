/**
 * Tests for GET /api/workspace/overview.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8209";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "overview-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET /api/workspace/overview", () => {
  it("returns workspace overview stats", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/overview"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total_channels).toBe("number");
    expect(typeof data.active_channels).toBe("number");
    expect(typeof data.total_members).toBe("number");
    expect(typeof data.total_messages).toBe("number");
    expect(typeof data.messages_last_24h).toBe("number");
    expect(typeof data.active_senders_last_24h).toBe("number");
    expect(typeof data.ws_clients).toBe("number");
  });

  it("has at least 1 channel and 1 member", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/overview"));
    const data = await res.json();
    expect(data.total_channels).toBeGreaterThan(0);
    expect(data.total_members).toBeGreaterThan(0);
  });

  it("reflects new messages in last 24h count", async () => {
    // Post a message
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    if (channels.length > 0) {
      await app.fetch(req("POST", `/api/channels/${channels[0].id}/messages`, { content: "overview test" }));
    }

    const res = await app.fetch(req("GET", "/api/workspace/overview"));
    const data = await res.json();
    expect(data.messages_last_24h).toBeGreaterThan(0);
  });
});
