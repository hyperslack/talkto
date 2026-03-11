/**
 * Tests for custom emoji CRUD endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8250";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Custom Emoji Registry", () => {
  let emojiId: string;

  it("adds a custom emoji", async () => {
    const res = await app.fetch(req("POST", "/api/custom-emoji", {
      shortcode: "partyparrot",
      image_url: "https://example.com/partyparrot.gif"
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.shortcode).toBe("partyparrot");
    expect(data.image_url).toBe("https://example.com/partyparrot.gif");
    expect(data.id).toBeDefined();
    emojiId = data.id;
  });

  it("lists custom emoji", async () => {
    const res = await app.fetch(req("GET", "/api/custom-emoji"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((e: any) => e.shortcode === "partyparrot")).toBe(true);
  });

  it("rejects duplicate shortcode", async () => {
    const res = await app.fetch(req("POST", "/api/custom-emoji", {
      shortcode: "partyparrot",
      image_url: "https://example.com/other.gif"
    }));
    expect(res.status).toBe(409);
  });

  it("normalizes shortcode to lowercase", async () => {
    const res = await app.fetch(req("POST", "/api/custom-emoji", {
      shortcode: "CoolCat",
      image_url: "https://example.com/coolcat.gif"
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.shortcode).toBe("coolcat");
  });

  it("deletes a custom emoji", async () => {
    const addRes = await app.fetch(req("POST", "/api/custom-emoji", {
      shortcode: "todelete",
      image_url: "https://example.com/del.gif"
    }));
    const emoji = await addRes.json();
    const res = await app.fetch(req("DELETE", `/api/custom-emoji/${emoji.id}`));
    expect(res.status).toBe(200);
  });

  it("returns 404 for deleting nonexistent emoji", async () => {
    const res = await app.fetch(req("DELETE", "/api/custom-emoji/nonexistent-id"));
    expect(res.status).toBe(404);
  });
});
