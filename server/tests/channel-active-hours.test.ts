/**
 * Tests for GET /api/channels/:channelId/active-hours endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8208";
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

describe("Channel Active Hours", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `active-hours-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;

    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "msg 1" })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "msg 2" })
    );
  });

  it("returns 24 hours of data", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/active-hours`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hours).toHaveLength(24);
    expect(data.channel_id).toBe(channelId);
  });

  it("identifies peak hour", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/active-hours`));
    const data = await res.json();
    expect(data.peak_hour).not.toBeNull();
    expect(typeof data.peak_hour).toBe("number");
  });

  it("hours have correct structure", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/active-hours`));
    const data = await res.json();
    for (const entry of data.hours) {
      expect(typeof entry.hour).toBe("number");
      expect(typeof entry.message_count).toBe("number");
      expect(entry.hour).toBeGreaterThanOrEqual(0);
      expect(entry.hour).toBeLessThanOrEqual(23);
    }
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/active-hours"));
    expect(res.status).toBe(404);
  });

  it("total message count matches posted messages", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/active-hours`));
    const data = await res.json();
    const total = data.hours.reduce((sum: number, h: { message_count: number }) => sum + h.message_count, 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
