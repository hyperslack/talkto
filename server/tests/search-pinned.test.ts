import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8167";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search results include is_pinned", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `srch-pin-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;

    // Create and pin a message
    const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "pinned-search-flag-test" }));
    const msg = await msgRes.json();
    await app.fetch(req("POST", `/api/channels/${channelId}/messages/${msg.id}/pin`));
  });

  it("returns is_pinned in search results", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=pinned-search-flag-test"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const pinned = data.results.find((r: any) => r.content === "pinned-search-flag-test");
    expect(pinned).toBeDefined();
    expect(pinned.is_pinned).toBe(true);
  });
});
