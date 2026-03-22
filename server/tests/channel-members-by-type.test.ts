/**
 * Tests for GET /api/channels/:channelId/members/by-type
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users, channels, channelMembers } from "../src/db/schema";

let app: any;
let generalId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "mbt-test-user", display_name: "MBT" }));

  const db = getDb();
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get()!;
  generalId = general.id;

  // Add the human user as a member
  const user = db.select().from(users).where(eq(users.name, "mbt-test-user")).get()!;
  db.insert(channelMembers).values({ channelId: generalId, userId: user.id, joinedAt: new Date().toISOString() }).run();
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Members By Type", () => {
  it("returns breakdown with total", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${generalId}/members/by-type`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(generalId);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.breakdown).toBeDefined();
  });

  it("includes human type in breakdown", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${generalId}/members/by-type`));
    const data = await res.json();
    expect(data.breakdown.human).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for invalid channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/members/by-type"));
    expect(res.status).toBe(404);
  });

  it("total equals sum of breakdown values", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${generalId}/members/by-type`));
    const data = await res.json();
    const sum = Object.values(data.breakdown).reduce((a: number, b: any) => a + b, 0);
    expect(data.total).toBe(sum);
  });
});
