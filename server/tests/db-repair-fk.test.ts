/**
 * Tests for the messages table self-FK repair logic.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8158";
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

describe("DB Repair - Messages FK", () => {
  it("messages table exists after startup", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    expect(res.status).toBe(200);
  });

  it("can create messages with parent_id (self-FK works)", async () => {
    // Get a channel
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const channelId = channels[0].id;

    // Create parent message
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "parent" })
    );
    expect(parentRes.status).toBe(201);
    const parent = await parentRes.json();

    // Create reply with parent_id
    const replyRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "reply",
        parent_id: parent.id,
      })
    );
    expect(replyRes.status).toBe(201);
    const reply = await replyRes.json();
    expect(reply.parent_id).toBe(parent.id);
  });

  it("messages with parent_id appear in GET response", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const channelId = channels[0].id;

    const msgRes = await app.fetch(req("GET", `/api/channels/${channelId}/messages`));
    expect(msgRes.status).toBe(200);
    const messages = await msgRes.json();

    // At least some messages should exist
    expect(messages.length).toBeGreaterThan(0);
  });
});
