/**
 * Tests for GET /api/channels/:channelId/messages/code-snippets endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8251";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Code Snippets", () => {
  let channelId: string;

  beforeAll(async () => {
    // Onboard a user first
    await app.fetch(req("POST", "/api/users/onboard", { name: "snippet-tester" }));

    // Create a channel
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `snippets-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    // Post messages with code blocks
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "Here is code:\n```typescript\nconst x = 1;\n```"
    }));
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "No code here"
    }));
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "```python\ndef hello():\n    pass\n```"
    }));
  });

  it("returns code snippets from channel", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/code-snippets`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it("filters by language", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/code-snippets?language=python`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].language).toBe("python");
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/messages/code-snippets"));
    expect(res.status).toBe(404);
  });

  it("includes message_id and sender_name", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/code-snippets`));
    const data = await res.json();
    expect(data[0].message_id).toBeDefined();
    expect(data[0].sender_name).toBeDefined();
    expect(data[0].code).toBeDefined();
  });
});
