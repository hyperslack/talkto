/**
 * Tests for POST /channels/:channelId/messages/bulk-delete endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8163";
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
        req("POST", `/api/channels/${channelId}/messages`, {
          content: `Bulk delete test message ${i}`,
        })
      );
      const msg = await msgRes.json();
      messageIds.push(msg.id);
    }
  });

  it("deletes multiple messages", async () => {
    const toDelete = messageIds.slice(0, 3);
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/bulk-delete`, {
        message_ids: toDelete,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(3);
    expect(data.deleted).toEqual(toDelete);
    expect(data.not_found).toEqual([]);
  });

  it("handles mix of existing and nonexistent IDs", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/bulk-delete`, {
        message_ids: [messageIds[3], "nonexistent-id"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(1);
    expect(data.not_found).toContain("nonexistent-id");
  });

  it("returns 400 with empty array", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/bulk-delete`, {
        message_ids: [],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 without message_ids", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/bulk-delete`, {})
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("POST", "/api/channels/nonexistent/messages/bulk-delete", {
        message_ids: ["some-id"],
      })
    );
    expect(res.status).toBe(404);
  });
});
