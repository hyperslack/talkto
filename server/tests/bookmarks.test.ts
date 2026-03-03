/**
 * Message bookmarks tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8115";
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

describe("Message bookmarks", () => {
  let messageId: string;

  it("creates a message to bookmark", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "bookmark me" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    messageId = data.id;
  });

  it("bookmarks a message", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/${messageId}/bookmark`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarked).toBe(true);
  });

  it("appears in bookmarks list", async () => {
    const res = await app.fetch(req("GET", "/api/bookmarks"));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.some((b: any) => b.message_id === messageId)).toBe(true);
    const bm = list.find((b: any) => b.message_id === messageId);
    expect(bm.content).toBe("bookmark me");
  });

  it("unbookmarks on second toggle", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/${messageId}/bookmark`)
    );
    const data = await res.json();
    expect(data.bookmarked).toBe(false);
  });

  it("no longer in bookmarks list", async () => {
    const res = await app.fetch(req("GET", "/api/bookmarks"));
    const list = await res.json();
    expect(list.some((b: any) => b.message_id === messageId)).toBe(false);
  });

  it("returns 404 for non-existent message", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages/nonexistent-id/bookmark`)
    );
    expect(res.status).toBe(404);
  });
});
