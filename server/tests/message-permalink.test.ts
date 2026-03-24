/**
 * Tests for single message permalink endpoint.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;
let channelId: string;
let messageId: string;

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
    name: "permalink-test-user",
    display_name: "Permalink Tester",
  }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  channelId = channels.find((c: any) => c.name === "#general")?.id;

  const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
    content: "permalink test message unique99",
  }));
  const msg = await msgRes.json();
  messageId = msg.id;
});

describe("Message Permalink", () => {
  it("returns a single message by ID", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(messageId);
    expect(data.content).toBe("permalink test message unique99");
    expect(data.sender_name).toBeDefined();
    expect(data.sender_type).toBe("human");
    expect(data.reactions).toBeArrayOfSize(0);
    expect(data.reply_count).toBe(0);
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/nonexistent-id`));
    expect(res.status).toBe(404);
  });

  it("returns 404 for wrong channel", async () => {
    // Create a different channel
    const chRes = await app.fetch(req("POST", "/api/channels", { name: "permalink-other" }));
    const ch = await chRes.json();
    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/messages/${messageId}`));
    expect(res.status).toBe(404);
  });

  it("includes reply count for parent messages", async () => {
    // Post a reply
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "reply to permalink test",
      parent_id: messageId,
    }));

    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageId}`));
    const data = await res.json();
    expect(data.reply_count).toBe(1);
  });

  it("includes pin status", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageId}`));
    const data = await res.json();
    expect(typeof data.is_pinned).toBe("boolean");
  });
});
