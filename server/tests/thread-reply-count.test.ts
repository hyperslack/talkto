/**
 * Thread reply count — verifies reply_count is returned in message responses.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8113";
  const mod = await import("../src/index");
  app = mod.app;

  const db = getDb();
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
  if (!general) throw new Error("Seed data missing: #general channel");
  generalChannelId = general.id;

  const human = db.select().from(users).where(eq(users.type, "human")).get();
  if (!human) {
    await app.fetch(req("POST", "/api/users/onboard", { name: "test-human" }));
  }
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Thread reply count", () => {
  it("returns reply_count=0 for messages with no replies", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "no replies here" })
    );
    expect(res.status).toBe(201);

    const listRes = await app.fetch(req("GET", `/api/channels/${generalChannelId}/messages?limit=50`));
    const msgs = await listRes.json();
    const msg = msgs.find((m: any) => m.content === "no replies here");
    expect(msg).toBeDefined();
    expect(msg.reply_count).toBe(0);
  });

  it("returns correct reply_count for a parent message", async () => {
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: `I am the parent thread-reply-${Date.now()}` })
    );
    expect(parentRes.status).toBe(201);
    const parent = await parentRes.json();

    for (const text of ["reply 1", "reply 2"]) {
      const r = await app.fetch(
        req("POST", `/api/channels/${generalChannelId}/messages`, {
          content: text,
          parent_id: parent.id,
        })
      );
      expect(r.status).toBe(201);
    }

    const listRes = await app.fetch(req("GET", `/api/channels/${generalChannelId}/messages?limit=50`));
    const msgs = await listRes.json();
    const parentMsg = msgs.find((m: any) => m.id === parent.id);
    expect(parentMsg).toBeDefined();
    expect(parentMsg.reply_count).toBe(2);
  });

  it("reply_count updates when a reply is deleted", async () => {
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "parent for delete test" })
    );
    const parent = await parentRes.json();

    const replyRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: `will be deleted thread-${Date.now()}`,
        parent_id: parent.id,
      })
    );
    const reply = await replyRes.json();

    await app.fetch(req("DELETE", `/api/channels/${generalChannelId}/messages/${reply.id}`));

    const listRes = await app.fetch(req("GET", `/api/channels/${generalChannelId}/messages?limit=50`));
    const msgs = await listRes.json();
    const parentMsg = msgs.find((m: any) => m.id === parent.id);
    expect(parentMsg).toBeDefined();
    expect(parentMsg.reply_count).toBe(0);
  });
});
