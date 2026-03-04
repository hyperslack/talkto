/**
 * Tests for DELETE /channels/:channelId endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8150";
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

describe("Channel Delete", () => {
  it("deletes a custom channel", async () => {
    // Create a channel first
    const createRes = await app.fetch(
      req("POST", "/api/channels", { name: `del-test-${Date.now()}` })
    );
    expect(createRes.status).toBe(201);
    const channel = await createRes.json();

    // Delete it
    const delRes = await app.fetch(req("DELETE", `/api/channels/${channel.id}`));
    expect(delRes.status).toBe(200);
    const data = await delRes.json();
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(channel.id);

    // Verify it's gone
    const getRes = await app.fetch(req("GET", `/api/channels/${channel.id}`));
    expect(getRes.status).toBe(404);
  });

  it("cannot delete #general channel", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const general = channels.find((ch: { name: string }) => ch.name === "#general");
    expect(general).toBeDefined();

    const delRes = await app.fetch(req("DELETE", `/api/channels/${general.id}`));
    expect(delRes.status).toBe(400);
    const data = await delRes.json();
    expect(data.detail).toContain("Cannot delete");
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("DELETE", "/api/channels/nonexistent-id"));
    expect(res.status).toBe(404);
  });

  it("cascade deletes messages in the channel", async () => {
    // Create channel
    const createRes = await app.fetch(
      req("POST", "/api/channels", { name: `cascade-del-${Date.now()}` })
    );
    const channel = await createRes.json();

    // Send a message
    await app.fetch(
      req("POST", `/api/channels/${channel.id}/messages`, { content: "will be deleted" })
    );

    // Delete channel
    const delRes = await app.fetch(req("DELETE", `/api/channels/${channel.id}`));
    expect(delRes.status).toBe(200);

    // Messages endpoint should 404 since channel is gone
    const msgRes = await app.fetch(req("GET", `/api/channels/${channel.id}/messages`));
    expect(msgRes.status).toBe(404);
  });
});
