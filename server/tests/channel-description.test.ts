/**
 * Channel description tests.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;
let generalChannelId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8117";
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

describe("Channel description", () => {
  it("sets a channel description", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${generalChannelId}/description`, {
        description: "This is the general channel for all discussions",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("This is the general channel for all discussions");
  });

  it("description appears in channel GET response", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${generalChannelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("This is the general channel for all discussions");
  });

  it("description appears in channel list", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const list = await res.json();
    const general = list.find((ch: any) => ch.id === generalChannelId);
    expect(general.description).toBe("This is the general channel for all discussions");
  });

  it("clears description with empty string", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${generalChannelId}/description`, { description: "" })
    );
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("returns 404 for non-existent channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/description", { description: "test" })
    );
    expect(res.status).toBe(404);
  });
});
