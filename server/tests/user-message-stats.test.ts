/**
 * Tests for user message stats endpoint.
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

describe("User Message Stats", () => {
  it("GET /users/me/stats returns stats object", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/stats"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user_id).toBeDefined();
    expect(typeof data.message_count).toBe("number");
    expect(typeof data.channels_active).toBe("number");
    expect("first_message_at" in data).toBe(true);
    expect("last_message_at" in data).toBe(true);
  });

  it("message_count is non-negative", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/stats"));
    const data = await res.json();
    expect(data.message_count).toBeGreaterThanOrEqual(0);
  });

  it("channels_active is non-negative", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/stats"));
    const data = await res.json();
    expect(data.channels_active).toBeGreaterThanOrEqual(0);
  });
});
