/**
 * Channel mute/unmute tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8114";
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

describe("Channel mute", () => {
  it("mutes a channel on first toggle", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${generalChannelId}/mute`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.muted).toBe(true);
    expect(data.channel_id).toBe(generalChannelId);
  });

  it("appears in muted list", async () => {
    const res = await app.fetch(req("GET", "/api/channels/muted/list"));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.some((m: any) => m.channel_id === generalChannelId)).toBe(true);
  });

  it("unmutes on second toggle", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${generalChannelId}/mute`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.muted).toBe(false);
  });

  it("no longer in muted list after unmute", async () => {
    const res = await app.fetch(req("GET", "/api/channels/muted/list"));
    const list = await res.json();
    expect(list.some((m: any) => m.channel_id === generalChannelId)).toBe(false);
  });

  it("returns 404 for non-existent channel", async () => {
    const res = await app.fetch(req("POST", "/api/channels/nonexistent-id/mute"));
    expect(res.status).toBe(404);
  });
});
