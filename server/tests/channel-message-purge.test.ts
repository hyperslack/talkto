/**
 * Tests for channel message purge endpoint.
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

describe("Channel Message Purge", () => {
  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("DELETE", "/api/channels/fake-id/messages/purge", {
        before: "2020-01-01T00:00:00.000Z",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when before is missing", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(
      req("DELETE", `/api/channels/${ch.id}/messages/purge`, {})
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid timestamp", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(
      req("DELETE", `/api/channels/${ch.id}/messages/purge`, {
        before: "not-a-date",
      })
    );
    expect(res.status).toBe(400);
  });

  it("purges messages before a very old date (returns 0)", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(
      req("DELETE", `/api/channels/${ch.id}/messages/purge`, {
        before: "2000-01-01T00:00:00.000Z",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(ch.id);
    expect(data.deleted_count).toBe(0);
    expect(data.purged_before).toBe("2000-01-01T00:00:00.000Z");
  });
});
