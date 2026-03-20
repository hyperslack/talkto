/**
 * Tests for GET /channels/:channelId/export endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8182";
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

describe("Channel Export", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `export-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    // Add some messages
    for (const content of ["hello", "world", "test message"]) {
      await app.fetch(
        req("POST", `/api/channels/${channelId}/messages`, { content })
      );
    }
  });

  it("exports channel history as JSON", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel.id).toBe(channelId);
    expect(data.message_count).toBe(3);
    expect(data.messages.length).toBe(3);
    expect(data.exported_at).toBeDefined();
  });

  it("messages are in chronological order", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const data = await res.json();
    expect(data.messages[0].content).toBe("hello");
    expect(data.messages[2].content).toBe("test message");
  });

  it("includes sender info", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const data = await res.json();
    expect(data.messages[0].sender_name).toBeDefined();
    expect(data.messages[0].sender_type).toBeDefined();
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export?limit=2`));
    const data = await res.json();
    expect(data.messages.length).toBe(2);
    expect(data.message_count).toBe(2);
  });

  it("sets Content-Disposition header", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("export.json");
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/export"));
    expect(res.status).toBe(404);
  });

  it("exports empty channel", async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `empty-export-${Date.now()}` })
    );
    const ch = await chRes.json();
    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/export`));
    const data = await res.json();
    expect(data.message_count).toBe(0);
    expect(data.messages).toEqual([]);
  });
});
