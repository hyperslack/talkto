/**
 * Tests for message attachment endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8257";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Message Attachments", () => {
  let channelId: string;
  let messageId: string;
  let attachmentId: string;

  beforeAll(async () => {
    await app.fetch(req("POST", "/api/users/onboard", { name: "attach-tester" }));
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `attach-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "Message with attachment"
    }));
    const msg = await msgRes.json();
    messageId = msg.id;
  });

  it("adds an attachment to a message", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages/${messageId}/attachments`, {
      filename: "test.png",
      url: "https://example.com/test.png",
      mime_type: "image/png",
      size_bytes: 12345
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.filename).toBe("test.png");
    expect(data.url).toBe("https://example.com/test.png");
    attachmentId = data.id;
  });

  it("lists message attachments", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageId}/attachments`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].filename).toBe("test.png");
  });

  it("lists channel attachments", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/attachments`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("deletes an attachment", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/messages/${messageId}/attachments/${attachmentId}`));
    expect(res.status).toBe(200);
  });

  it("returns 404 for deleting nonexistent attachment", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/messages/${messageId}/attachments/nonexistent`));
    expect(res.status).toBe(404);
  });
});
