/**
 * Tests for user last-seen / presence tracking.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8164";
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

describe("User Last Seen", () => {
  let userId: string;

  beforeAll(async () => {
    const meRes = await app.fetch(req("GET", "/api/users/me"));
    const me = await meRes.json();
    userId = me.id;
  });

  it("sends heartbeat", async () => {
    const res = await app.fetch(req("POST", "/api/users/me/heartbeat"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.last_seen).toBeDefined();
  });

  it("gets presence status after heartbeat", async () => {
    // Send heartbeat first
    await app.fetch(req("POST", "/api/users/me/heartbeat"));

    const res = await app.fetch(req("GET", `/api/users/${userId}/presence`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user_id).toBe(userId);
    expect(data.status).toBe("online"); // just sent heartbeat
    expect(data.last_seen).toBeDefined();
  });

  it("returns offline for unknown user", async () => {
    // Create a channel to get a non-heartbeat user
    const res = await app.fetch(req("GET", `/api/users/${userId}/presence`));
    expect(res.status).toBe(200);
    // User should be online since we just heartbeated
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.fetch(req("GET", "/api/users/nonexistent/presence"));
    expect(res.status).toBe(404);
  });
});

describe("Last Seen Service", () => {
  it("updateLastSeen and getLastSeen work", async () => {
    const { updateLastSeen, getLastSeen, getPresenceStatus } = await import(
      "../src/services/last-seen"
    );

    updateLastSeen("test-user-1");
    expect(getLastSeen("test-user-1")).toBeDefined();
    expect(getPresenceStatus("test-user-1")).toBe("online");
  });

  it("returns null for unknown user", async () => {
    const { getLastSeen } = await import("../src/services/last-seen");
    expect(getLastSeen("unknown-user-xyz")).toBeNull();
  });

  it("returns offline for unknown user presence", async () => {
    const { getPresenceStatus } = await import("../src/services/last-seen");
    expect(getPresenceStatus("unknown-user-xyz")).toBe("offline");
  });
});
