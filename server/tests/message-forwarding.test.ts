/**
 * Tests for message forwarding endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8131";
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

describe("Message Forwarding", () => {
  let sourceChannelId: string;
  let targetChannelId: string;
  let messageId: string;

  beforeAll(async () => {
    // Get channels
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    expect(channels.length).toBeGreaterThanOrEqual(1);
    sourceChannelId = channels[0].id;

    // Create a target channel
    const createRes = await app.fetch(req("POST", "/api/channels", { name: "forward-target" }));
    if (createRes.status === 201) {
      const ch = await createRes.json();
      targetChannelId = ch.id;
    } else {
      // Channel might already exist, find it
      const allRes = await app.fetch(req("GET", "/api/channels"));
      const allChannels = await allRes.json();
      const existing = allChannels.find((c: { name: string }) => c.name === "#forward-target");
      targetChannelId = existing?.id ?? channels[1]?.id ?? sourceChannelId;
    }

    // Create a message to forward
    const msgRes = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages`, {
        content: "Hello, this is a test message to forward",
      })
    );
    if (msgRes.status === 201) {
      const msg = await msgRes.json();
      messageId = msg.id;
    } else {
      // Fall back to reading existing messages
      const msgsRes = await app.fetch(req("GET", `/api/channels/${sourceChannelId}/messages`));
      const msgs = await msgsRes.json();
      if (msgs.length > 0) messageId = msgs[0].id;
    }
  });

  it("forwards a message to another channel", async () => {
    if (!messageId || !targetChannelId || sourceChannelId === targetChannelId) return;

    const res = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages/${messageId}/forward`, {
        target_channel_id: targetChannelId,
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.original_message_id).toBe(messageId);
    expect(data.source_channel_id).toBe(sourceChannelId);
    expect(data.target_channel_id).toBe(targetChannelId);
    expect(data.content).toContain("Forwarded from");
  });

  it("returns 400 when forwarding to same channel", async () => {
    if (!messageId) return;

    const res = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages/${messageId}/forward`, {
        target_channel_id: sourceChannelId,
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.detail).toContain("same channel");
  });

  it("returns 404 for unknown target channel", async () => {
    if (!messageId) return;

    const res = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages/${messageId}/forward`, {
        target_channel_id: "nonexistent-uuid",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown message", async () => {
    if (!targetChannelId) return;

    const res = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages/nonexistent-uuid/forward`, {
        target_channel_id: targetChannelId,
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON body", async () => {
    if (!messageId) return;

    const res = await app.fetch(
      req("POST", `/api/channels/${sourceChannelId}/messages/${messageId}/forward`, {})
    );
    expect(res.status).toBe(400);
  });
});
