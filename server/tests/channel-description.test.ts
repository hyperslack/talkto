/**
 * Tests for PATCH /channels/:channelId/description endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8165";
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

describe("Channel Description", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `desc-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("sets a channel description", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "This channel is for discussing project updates and milestones.",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe(
      "This channel is for discussing project updates and milestones."
    );
  });

  it("description persists on GET", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe(
      "This channel is for discussing project updates and milestones."
    );
  });

  it("clears description with null", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: null,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/description", {
        description: "test",
      })
    );
    expect(res.status).toBe(404);
  });

  it("description appears in channel list", async () => {
    // Set it again
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "Listed description",
      })
    );
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    const ch = channels.find((c: any) => c.id === channelId);
    expect(ch.description).toBe("Listed description");
  });
});
