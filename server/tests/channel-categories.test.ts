/**
 * Tests for channel categories feature.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8132";
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

describe("Channel Categories", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    channelId = channels[0].id;
  });

  it("channels have null category by default", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("category");
  });

  it("sets a category on a channel", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/category`, { category: "Projects" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.category).toBe("Projects");
  });

  it("clears a category with null", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/category`, { category: null })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.category).toBeNull();
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/nonexistent/category`, { category: "Test" })
    );
    expect(res.status).toBe(404);
  });

  it("lists categories", async () => {
    // Set a category first
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/category`, { category: "Engineering" })
    );
    const res = await app.fetch(req("GET", "/api/channels/categories/list"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.categories).toBeInstanceOf(Array);
    expect(data.categories).toContain("Engineering");
  });
});
