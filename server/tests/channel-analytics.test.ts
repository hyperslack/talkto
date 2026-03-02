/**
 * Channel analytics endpoint tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8093";
  const mod = await import("../src/index");
  app = mod.app;

  const db = getDb();
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
  if (!general) throw new Error("Seed data missing: #general channel");
  generalChannelId = general.id;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Channel Analytics", () => {
  it("returns analytics for a channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/analytics`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.channel_id).toBe(generalChannelId);
    expect(data.channel_name).toBe("#general");
    expect(typeof data.message_count).toBe("number");
    expect(typeof data.unique_senders).toBe("number");
    expect(Array.isArray(data.top_senders)).toBe(true);
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("GET", "/api/channels/nonexistent-id/analytics")
    );
    expect(res.status).toBe(404);
  });

  it("top_senders have correct structure", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/analytics`)
    );
    const data = await res.json();

    for (const sender of data.top_senders) {
      expect(sender.sender_id).toBeDefined();
      expect(sender.sender_name).toBeDefined();
      expect(sender.sender_type).toBeDefined();
      expect(typeof sender.message_count).toBe("number");
    }
  });

  it("includes timestamp fields", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/analytics`)
    );
    const data = await res.json();

    // These can be null if no messages, but should be present
    expect("first_message_at" in data).toBe(true);
    expect("last_message_at" in data).toBe(true);
  });
});
