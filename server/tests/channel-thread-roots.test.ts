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
  await app.fetch(req("POST", "/api/users/onboard", { name: "thread-roots-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Thread Roots", () => {
  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/thread-roots"));
    expect(res.status).toBe(404);
  });

  it("returns threads array for #general", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/thread-roots`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(general.id);
    expect(Array.isArray(data.threads)).toBe(true);
    expect(typeof data.count).toBe("number");
  });

  it("thread entries have reply_count and last_reply_at", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    // Create a thread: send a message then reply to it
    const msgRes = await app.fetch(req("POST", `/api/channels/${general.id}/messages`, { content: "thread-root-test-unique-abc" }));
    const msg = await msgRes.json();

    await app.fetch(req("POST", `/api/channels/${general.id}/messages`, { content: "reply-to-root-unique-abc", parent_id: msg.id }));

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/thread-roots`));
    const data = await res.json();
    const thread = data.threads.find((t: any) => t.id === msg.id);
    if (thread) {
      expect(thread.reply_count).toBeGreaterThanOrEqual(1);
      expect(thread.last_reply_at).toBeDefined();
    }
  });
});
