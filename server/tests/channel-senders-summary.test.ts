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
  await app.fetch(req("POST", "/api/users/onboard", { name: "senders-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Senders Summary", () => {
  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/senders"));
    expect(res.status).toBe(404);
  });

  it("returns sender breakdown for #general", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/senders`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(general.id);
    expect(typeof data.total_senders).toBe("number");
    expect(Array.isArray(data.senders)).toBe(true);
  });

  it("sender entries have required fields", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/senders`));
    const data = await res.json();
    if (data.senders.length > 0) {
      const s = data.senders[0];
      expect(s.sender_id).toBeDefined();
      expect(s.sender_name).toBeDefined();
      expect(s.sender_type).toBeDefined();
      expect(typeof s.message_count).toBe("number");
    }
  });

  it("senders sorted by message count descending", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/senders`));
    const data = await res.json();
    for (let i = 1; i < data.senders.length; i++) {
      expect(data.senders[i - 1].message_count).toBeGreaterThanOrEqual(data.senders[i].message_count);
    }
  });
});
