/**
 * Tests for channel threads listing endpoint.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;
let channelId: string;
let parentMsgId: string;

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
    name: "threads-test-user",
    display_name: "Threads Tester",
  }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  channelId = channels.find((c: any) => c.name === "#general")?.id;

  // Create a parent message
  const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "parent message for thread test unique88",
  }));
  const msg = await msgRes.json();
  parentMsgId = msg.id;

  // Create replies
  await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "reply one to thread test",
    parent_id: parentMsgId,
  }));
  await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "reply two to thread test",
    parent_id: parentMsgId,
  }));
});

describe("Channel Threads", () => {
  it("lists threads with reply counts", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/threads`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.threads.length).toBeGreaterThanOrEqual(1);

    const thread = data.threads.find((t: any) => t.parent_id === parentMsgId);
    expect(thread).toBeDefined();
    expect(thread.reply_count).toBe(2);
    expect(thread.parent_sender_name).toBeDefined();
    expect(thread.last_reply_at).toBeDefined();
  });

  it("returns empty for channel with no threads", async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: "no-threads-chan" }));
    const ch = await chRes.json();

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/threads`));
    const data = await res.json();
    expect(data.threads).toBeArrayOfSize(0);
    expect(data.count).toBe(0);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/threads"));
    expect(res.status).toBe(404);
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/threads?limit=1`));
    const data = await res.json();
    expect(data.threads.length).toBeLessThanOrEqual(1);
  });

  it("truncates long parent content", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/threads`));
    const data = await res.json();
    for (const thread of data.threads) {
      expect(thread.parent_content.length).toBeLessThanOrEqual(200);
    }
  });
});
