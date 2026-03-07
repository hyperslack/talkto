/**
 * Tests for user custom status (emoji + text).
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("User Custom Status", () => {
  it("GET /users/me includes status fields", async () => {
    const res = await app.fetch(req("GET", "/api/users/me"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect("status_emoji" in data).toBe(true);
    expect("status_text" in data).toBe(true);
  });

  it("PATCH /users/me/status sets emoji and text", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/status", {
        status_emoji: "🏠",
        status_text: "Working from home",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status_emoji).toBe("🏠");
    expect(data.status_text).toBe("Working from home");
  });

  it("PATCH /users/me/status clears status with null", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/status", {
        status_emoji: null,
        status_text: null,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status_emoji).toBeNull();
    expect(data.status_text).toBeNull();
  });

  it("PATCH /users/me/status rejects overly long text", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/status", {
        status_text: "x".repeat(101),
      })
    );
    expect(res.status).toBe(400);
  });

  it("PATCH /users/me/status allows partial update (emoji only)", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/status", {
        status_emoji: "🎯",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status_emoji).toBe("🎯");
  });
});
