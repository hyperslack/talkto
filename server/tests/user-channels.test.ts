/**
 * Tests for GET /api/users/me/channels — list channels user belongs to.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users, channels, channelMembers } from "../src/db/schema";

let app: any;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "uc-test-user-v3", display_name: "UC User" }));

  // Manually add user as member of #general
  const db = getDb();
  const user = db.select().from(users).where(eq(users.name, "uc-test-user-v3")).get()!;
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get()!;

  db.insert(channelMembers).values({
    channelId: general.id,
    userId: user.id,
    joinedAt: new Date().toISOString(),
  }).run();
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("User Channels List", () => {
  it("GET /api/users/me/channels returns channel list", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channels).toBeDefined();
    expect(Array.isArray(data.channels)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("includes #general channel", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/channels"));
    const data = await res.json();
    const general = data.channels.find((c: any) => c.name === "#general");
    expect(general).toBeDefined();
    expect(general.type).toBe("general");
  });

  it("each channel has required fields", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/channels"));
    const data = await res.json();
    for (const ch of data.channels) {
      expect(ch.id).toBeDefined();
      expect(ch.name).toBeDefined();
      expect(ch.type).toBeDefined();
      expect(ch.joined_at).toBeDefined();
      expect(typeof ch.is_archived).toBe("boolean");
    }
  });

  it("count matches channels array length", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/channels"));
    const data = await res.json();
    expect(data.count).toBe(data.channels.length);
  });
});
