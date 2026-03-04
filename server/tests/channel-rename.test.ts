/**
 * Tests for PATCH /channels/:channelId/name endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8151";
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

describe("Channel Rename", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `rename-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("renames a channel", async () => {
    const newName = `renamed-${Date.now()}`;
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/name`, { name: newName })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(`#${newName}`);
  });

  it("auto-prepends # if missing", async () => {
    const newName = `nohash-${Date.now()}`;
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/name`, { name: newName })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name.startsWith("#")).toBe(true);
  });

  it("cannot rename #general", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const general = channels.find((ch: { name: string }) => ch.name === "#general");

    const res = await app.fetch(
      req("PATCH", `/api/channels/${general.id}/name`, { name: "not-general" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate name in same workspace", async () => {
    // Create another channel
    const other = await app.fetch(
      req("POST", "/api/channels", { name: `dup-target-${Date.now()}` })
    );
    const otherCh = await other.json();

    // Try to rename our channel to the other's name (without #)
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/name`, { name: otherCh.name.replace("#", "") })
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/name", { name: "whatever" })
    );
    expect(res.status).toBe(404);
  });
});
