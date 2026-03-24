/**
 * Tests for human typing indicator endpoint.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;
let channelId: string;

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;

  await app.fetch(req("POST", "/api/users/onboard", {
    name: "typing-test-user",
    display_name: "Typing Tester",
  }));

  const res = await app.fetch(req("GET", "/api/channels"));
  const channels = await res.json();
  channelId = channels.find((c: any) => c.name === "#general")?.id;
});

describe("Human Typing Indicator", () => {
  it("returns ok for valid channel", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/typing`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("POST", "/api/channels/nonexistent-id/typing"));
    expect(res.status).toBe(404);
  });

  it("works with repeated calls (debouncing is client-side)", async () => {
    const res1 = await app.fetch(req("POST", `/api/channels/${channelId}/typing`));
    const res2 = await app.fetch(req("POST", `/api/channels/${channelId}/typing`));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
