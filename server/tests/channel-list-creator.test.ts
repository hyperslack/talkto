import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8168";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel list includes created_by_name", () => {
  it("GET /channels returns created_by_name for each channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const ch of data) {
      expect("created_by_name" in ch).toBe(true);
    }
  });

  it("created_by_name matches individual channel GET", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const ch = channels[0];

    const detailRes = await app.fetch(req("GET", `/api/channels/${ch.id}`));
    const detail = await detailRes.json();

    expect(ch.created_by_name).toBe(detail.created_by_name);
  });
});
