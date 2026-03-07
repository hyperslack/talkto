/**
 * Tests that the messages table self-referencing FK is correct after migration.
 * Verifies parent_id references "messages" (not "messages_new").
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8112";
  const mod = await import("../src/index");
  app = mod.app;

  const db = getDb();
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
  if (!general) throw new Error("Seed data missing: #general channel");
  generalChannelId = general.id;

  // Ensure a human exists
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

describe("Messages self-referencing FK fix", () => {
  it("messages table DDL does not reference messages_new", () => {
    const db = getDb();
    const row = db.all(sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'`);
    const ddl = (row[0] as any)?.sql ?? "";
    expect(ddl).not.toContain("messages_new");
    expect(ddl).toContain("REFERENCES messages(id)");
  });

  it("can insert a message with parent_id (reply) without error", async () => {
    // Create parent message
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "parent message" })
    );
    expect(parentRes.status).toBe(201);
    const parent = await parentRes.json();

    // Create reply
    const replyRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "reply message",
        parent_id: parent.id,
      })
    );
    expect(replyRes.status).toBe(201);
    const reply = await replyRes.json();
    expect(reply.parent_id).toBe(parent.id);
  });

  it("can delete a parent without losing the reply (SET NULL)", async () => {
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "will be deleted" })
    );
    const parent = await parentRes.json();

    const replyRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "orphan reply",
        parent_id: parent.id,
      })
    );
    const reply = await replyRes.json();

    // Delete parent
    const delRes = await app.fetch(
      req("DELETE", `/api/channels/${generalChannelId}/messages/${parent.id}`)
    );
    expect(delRes.status).toBe(200);

    // Fetch messages — reply should still exist with parent_id = null
    const listRes = await app.fetch(req("GET", `/api/channels/${generalChannelId}/messages?limit=50`));
    const msgs = await listRes.json();
    const orphan = msgs.find((m: any) => m.id === reply.id);
    expect(orphan).toBeDefined();
    expect(orphan.parent_id).toBeNull();
  });
});
