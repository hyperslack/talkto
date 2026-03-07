/**
 * Bulk message delete tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8116";
  const mod = await import("../src/index");
  app = mod.app;

  const db = getDb();
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
  if (!general) throw new Error("Seed data missing");
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

describe("Bulk message delete", () => {
  it("deletes multiple messages at once", async () => {
    // Create 3 messages
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.fetch(
        req("POST", `/api/channels/${generalChannelId}/messages`, { content: `bulk-${i}` })
      );
      const data = await res.json();
      ids.push(data.id);
    }

    // Bulk delete
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/bulk-delete`, {
        message_ids: ids,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(3);
    expect(data.deleted).toEqual(ids);
    expect(data.failed).toEqual([]);
  });

  it("reports failed IDs for non-existent messages", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/bulk-delete`, {
        message_ids: ["nonexistent-1", "nonexistent-2"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted_count).toBe(0);
    expect(data.failed.length).toBe(2);
  });

  it("rejects empty message_ids array", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/bulk-delete`, {
        message_ids: [],
      })
    );
    expect(res.status).toBe(400);
  });

  it("handles mix of valid and invalid IDs", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "keep me" })
    );
    const msg = await res.json();

    const bulkRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/bulk-delete`, {
        message_ids: [msg.id, "nonexistent"],
      })
    );
    const data = await bulkRes.json();
    expect(data.deleted_count).toBe(1);
    expect(data.deleted).toEqual([msg.id]);
    expect(data.failed).toEqual(["nonexistent"]);
  });
});
