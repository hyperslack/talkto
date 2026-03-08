/**
 * Workspace activity summary tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8118";
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

describe("Activity summary", () => {
  it("returns activity summary structure", async () => {
    const res = await app.fetch(req("GET", "/api/activity"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.period).toBe("24h");
    expect(typeof data.message_count).toBe("number");
    expect(typeof data.active_channels).toBe("number");
    expect(typeof data.active_senders).toBe("number");
    expect(Array.isArray(data.top_channels)).toBe(true);
    expect(data.since).toBeDefined();
  });

  it("counts messages sent in the period", async () => {
    // Send a message
    await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content: "activity test" })
    );

    const res = await app.fetch(req("GET", "/api/activity"));
    const data = await res.json();
    expect(data.message_count).toBeGreaterThanOrEqual(1);
    expect(data.active_channels).toBeGreaterThanOrEqual(1);
    expect(data.active_senders).toBeGreaterThanOrEqual(1);
  });

  it("supports different periods", async () => {
    for (const period of ["1h", "24h", "7d", "30d"]) {
      const res = await app.fetch(req("GET", `/api/activity?period=${period}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.period).toBe(period);
    }
  });

  it("includes top channels", async () => {
    const res = await app.fetch(req("GET", "/api/activity"));
    const data = await res.json();
    if (data.top_channels.length > 0) {
      const ch = data.top_channels[0];
      expect(ch.channel_id).toBeDefined();
      expect(ch.channel_name).toBeDefined();
      expect(typeof ch.message_count).toBe("number");
    }
  });
});
