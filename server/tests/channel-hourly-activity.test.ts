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
  await app.fetch(req("POST", "/api/users/onboard", { name: "hourly-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Hourly Activity", () => {
  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/hourly-activity"));
    expect(res.status).toBe(404);
  });

  it("returns 24 hours for #general", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/hourly-activity`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hours.length).toBe(24);
    expect(typeof data.peak_hour).toBe("number");
    expect(data.peak_hour).toBeGreaterThanOrEqual(0);
    expect(data.peak_hour).toBeLessThan(24);
    expect(typeof data.total_messages).toBe("number");
  });

  it("respects days parameter", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/hourly-activity?days=7`));
    const data = await res.json();
    expect(data.days).toBe(7);
  });
});
