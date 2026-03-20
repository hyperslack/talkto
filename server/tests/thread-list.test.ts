/**
 * Tests for GET /messages/threads — list all threads in a channel.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8189";
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

describe("Thread List", () => {
  let channelId: string;
  let parentId1: string;
  let parentId2: string;

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `thread-list-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    // Create two parent messages
    const msg1 = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Thread parent 1" })
    );
    parentId1 = (await msg1.json()).id;

    const msg2 = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Thread parent 2" })
    );
    parentId2 = (await msg2.json()).id;

    // Add replies to parent 1 (2 replies)
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Reply 1a", parent_id: parentId1 })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Reply 1b", parent_id: parentId1 })
    );

    // Add replies to parent 2 (1 reply)
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Reply 2a", parent_id: parentId2 })
    );
  });

  it("lists threads in a channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/threads`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
    expect(data.threads.length).toBe(2);
  });

  it("threads ordered by most recent reply", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/threads`)
    );
    const data = await res.json();
    // Threads should be ordered by last_reply_at descending
    if (data.threads.length >= 2) {
      expect(data.threads[0].last_reply_at >= data.threads[1].last_reply_at).toBe(true);
    }
  });

  it("includes reply count per thread", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/threads`)
    );
    const data = await res.json();
    const thread1 = data.threads.find((t: any) => t.parent_id === parentId1);
    const thread2 = data.threads.find((t: any) => t.parent_id === parentId2);
    expect(thread1.reply_count).toBe(2);
    expect(thread2.reply_count).toBe(1);
  });

  it("includes parent message info", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/threads`)
    );
    const data = await res.json();
    expect(data.threads[0].parent_content).toBeDefined();
    expect(data.threads[0].parent_sender_name).toBeDefined();
    expect(data.threads[0].last_reply_at).toBeDefined();
  });

  it("returns empty for channel with no threads", async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `no-threads-${Date.now()}` })
    );
    const ch = await chRes.json();
    const res = await app.fetch(
      req("GET", `/api/channels/${ch.id}/messages/threads`)
    );
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.threads).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/threads?limit=1`)
    );
    const data = await res.json();
    expect(data.count).toBe(1);
  });
});
