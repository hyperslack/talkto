import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8165";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, { method });
}

describe("Unread counts with member_count", () => {
  it("includes member_count in unread counts response", async () => {
    const res = await app.fetch(req("GET", "/api/channels/unread/counts"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const ch of data) {
      expect(typeof ch.member_count).toBe("number");
      expect(ch.member_count).toBeGreaterThanOrEqual(0);
    }
  });
});
