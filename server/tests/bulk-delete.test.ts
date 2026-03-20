/**
 * Tests for DELETE /messages/bulk endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8184";
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

describe("Bulk Message Delete", () => {
  let channelId: string;
  const messageIds: string[] = [];

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `bulk-del-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    for (let i = 0; i < 5; i++) {
      const msgRes = await app.fetch(
        req("POST", `/api/channels/${channelId}/messages`, { content: `msg-${i}` })
      );
      const msg = await msgRes.json();
      messageIds.push(msg.id);
    }
  });

  it("deletes multiple messages", async () => {
    const toDelete = messageIds.slice(0, 3);
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/messages/bulk`, { message_ids: toDelete })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(3);
    expect(data.deleted).toEqual(toDelete);
    expect(data.failed_count).toBe(0);
  });

  it("reports failed for nonexistent message ids", async () => {
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/messages/bulk`, {
        message_ids: ["nonexistent-1", "nonexistent-2"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(0);
    expect(data.failed_count).toBe(2);
  });

  it("rejects empty message_ids array", async () => {
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/messages/bulk`, { message_ids: [] })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing body", async () => {
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/messages/bulk`)
    );
    expect(res.status).toBe(400);
  });

  it("handles mix of valid and invalid ids", async () => {
    const remaining = messageIds.slice(3); // 2 remaining
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/messages/bulk`, {
        message_ids: [...remaining, "fake-id"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(2);
    expect(data.failed_count).toBe(1);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("DELETE", "/api/channels/nonexistent/messages/bulk", { message_ids: ["x"] })
    );
    expect(res.status).toBe(404);
  });
});
