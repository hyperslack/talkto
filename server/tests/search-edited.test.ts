import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8169";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search results include edited_at", () => {
  let channelId: string;
  const uniqueContent = `search-edited-test-${Date.now()}`;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `srch-edit-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;

    // Create a message and edit it
    const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: uniqueContent }));
    const msg = await msgRes.json();
    await app.fetch(req("PATCH", `/api/channels/${channelId}/messages/${msg.id}`, { content: uniqueContent }));
  });

  it("returns edited_at in search results for edited message", async () => {
    const res = await app.fetch(req("GET", `/api/search?q=${encodeURIComponent(uniqueContent)}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const edited = data.results.find((r: any) => r.content === uniqueContent);
    expect(edited).toBeDefined();
    expect(edited.edited_at).toBeDefined();
    expect(edited.edited_at).not.toBeNull();
  });

  it("returns null edited_at for unedited messages", async () => {
    const uneditedContent = `unedited-search-${Date.now()}`;
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: uneditedContent }));

    const res = await app.fetch(req("GET", `/api/search?q=${encodeURIComponent(uneditedContent)}`));
    const data = await res.json();
    const unedited = data.results.find((r: any) => r.content === uneditedContent);
    expect(unedited).toBeDefined();
    expect(unedited.edited_at).toBeNull();
  });
});
