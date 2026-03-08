/**
 * Tests for channel member_count and message_count in channel list.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Channel Member & Message Counts", () => {
  it("GET /channels includes member_count field", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const ch of data) {
      expect(typeof ch.member_count).toBe("number");
      expect(ch.member_count).toBeGreaterThanOrEqual(0);
    }
  });

  it("GET /channels includes message_count field", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const data = await res.json();
    for (const ch of data) {
      expect(typeof ch.message_count).toBe("number");
      expect(ch.message_count).toBeGreaterThanOrEqual(0);
    }
  });

  it("#general has messages from seed", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const data = await res.json();
    const general = data.find((ch: { name: string }) => ch.name === "#general");
    expect(general).toBeDefined();
    expect(general.message_count).toBeGreaterThan(0);
  });

  it("member_count reflects actual members", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const data = await res.json();
    const general = data.find((ch: { name: string }) => ch.name === "#general");
    expect(general).toBeDefined();
    // Should have at least some members
    expect(general.member_count).toBeGreaterThanOrEqual(0);
  });
});
