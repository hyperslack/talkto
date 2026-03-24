/**
 * Tests for mark all channels read endpoint.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;

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
    name: "readall-test-user",
    display_name: "Read All Tester",
  }));
});

describe("Mark All Channels Read", () => {
  it("marks all channels as read", async () => {
    const res = await app.fetch(req("POST", "/api/channels/read-all"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channels_marked).toBeGreaterThan(0);
    expect(data.last_read_at).toBeDefined();
  });

  it("results in zero unread counts", async () => {
    // First post a message
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const generalId = channels.find((c: any) => c.name === "#general")?.id;

    await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
      content: "test message before read-all unique77",
    }));

    // Mark all read
    await app.fetch(req("POST", "/api/channels/read-all"));

    // Check unread counts
    const unreadRes = await app.fetch(req("GET", "/api/channels/unread/counts"));
    const unreadData = await unreadRes.json();
    const generalUnread = unreadData.find((u: any) => u.channel_id === generalId);
    expect(generalUnread.unread_count).toBe(0);
  });

  it("is idempotent", async () => {
    const res1 = await app.fetch(req("POST", "/api/channels/read-all"));
    const res2 = await app.fetch(req("POST", "/api/channels/read-all"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
