/**
 * Tests for GET /channels/:channelId/export endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8162";
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

    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "First message for export",
      })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Second message for export",
      })
    );
  });

  it("exports channel as JSON by default", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel.id).toBe(channelId);
    expect(data.message_count).toBe(2);
    expect(data.messages.length).toBe(2);
    expect(data.exported_at).toBeDefined();
  });

  it("messages are in chronological order", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const data = await res.json();
    expect(data.messages[0].content).toBe("First message for export");
    expect(data.messages[1].content).toBe("Second message for export");
  });

  it("exports as text format", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/export?format=text`)
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("First message for export");
    expect(text).toContain("Second message for export");
  });

  it("includes sender name in export", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const data = await res.json();
    expect(data.messages[0].sender_name).toBeDefined();
    expect(data.messages[0].sender_type).toBeDefined();
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/export"));
    expect(res.status).toBe(404);
  });

  it("includes Content-Disposition header", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/export`));
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("export.json");
  });
});
