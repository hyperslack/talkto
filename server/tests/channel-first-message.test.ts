/**
 * Tests for GET /api/channels/:channelId/first-message endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";
import { getDb } from "../src/db";
import { channels } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", {
    name: "first-msg-boss",
    display_name: "Boss",
  }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel First Message", () => {
  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/first-message"));
    expect(res.status).toBe(404);
  });

  it("returns first message for #general", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/first-message`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.channel_id).toBe(general.id);
    expect(data.sender_name).toBeDefined();
    expect(data.content).toBeDefined();
    expect(data.created_at).toBeDefined();
  });

  it("returns 404 for empty channel", async () => {
    // Create an empty channel
    const createRes = await app.fetch(req("POST", "/api/channels", { name: "#empty-first-msg-test" }));
    const ch = await createRes.json();

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/first-message`));
    expect(res.status).toBe(404);
  });
});
