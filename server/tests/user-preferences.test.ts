/**
 * Tests for user preferences.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8135";
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

describe("User Preferences", () => {
  it("returns default preferences", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/preferences"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.theme).toBe("system");
    expect(data.notify_mentions).toBe(true);
    expect(data.notify_dms).toBe(true);
    expect(data.notify_all).toBe(false);
    expect(data.compact_mode).toBe(false);
  });

  it("updates theme preference", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/preferences", { theme: "dark" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.theme).toBe("dark");
  });

  it("updates notification preferences", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/preferences", {
        notify_mentions: false,
        notify_all: true,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notify_mentions).toBe(false);
    expect(data.notify_all).toBe(true);
  });

  it("updates compact mode", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/preferences", { compact_mode: true })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.compact_mode).toBe(true);
  });

  it("persists preferences across reads", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/preferences"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.theme).toBe("dark");
    expect(data.compact_mode).toBe(true);
  });

  it("updates timezone", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/users/me/preferences", { timezone: "America/New_York" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.timezone).toBe("America/New_York");
  });
});
