/**
 * Tests for channel description field and PATCH endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8185";
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

  it("channel starts with null description", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("sets channel description", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "This channel is for discussing project updates",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("This channel is for discussing project updates");
  });

  it("description persists on GET", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    const data = await res.json();
    expect(data.description).toBe("This channel is for discussing project updates");
  });

  it("clears description with empty string", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, { description: "" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("rejects too-long description", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "x".repeat(2001),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/description", { description: "test" })
    );
    expect(res.status).toBe(404);
  });

  it("description is separate from topic", async () => {
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/topic`, { topic: "my topic" })
    );
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, { description: "my description" })
    );
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    const data = await res.json();
    expect(data.topic).toBe("my topic");
    expect(data.description).toBe("my description");
  });
});
