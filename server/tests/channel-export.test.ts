/**
 * Tests for channel message export endpoint.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;
let channelId: string;

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;

  await app.fetch(req("POST", "/api/users/onboard", {
    name: "export-test-user",
    display_name: "Export Tester",
  }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  channelId = channels.find((c: any) => c.name === "#general")?.id;

  await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "export test message alpha",
  }));
  await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "export test message beta",
  }));
});

describe("Channel Export", () => {
  it("exports messages as JSON", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/export`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const data = JSON.parse(await res.text());
    expect(data.channel.id).toBe(channelId);
    expect(data.messages.length).toBeGreaterThanOrEqual(2);
    expect(data.exported_at).toBeDefined();
  });

  it("exports messages as CSV", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/export?format=csv`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");

    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe("id,sender_name,sender_type,content,created_at");
    expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 messages
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/export?limit=1`));
    const data = JSON.parse(await res.text());
    expect(data.messages.length).toBe(1);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/messages/export"));
    expect(res.status).toBe(404);
  });

  it("handles CSV content with commas and quotes", async () => {
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: 'message with "quotes" and, commas',
    }));

    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/export?format=csv`));
    const text = await res.text();
    // Quotes should be escaped
    expect(text).toContain('""quotes""');
  });
});
