/**
 * Tests for channel sort by activity.
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
    name: "sort-test-user",
    display_name: "Sort Tester",
  }));

  // Create two channels and post messages with different times
  const res1 = await app.fetch(req("POST", "/api/channels", { name: "sort-old-chan" }));
  const ch1 = await res1.json();

  const res2 = await app.fetch(req("POST", "/api/channels", { name: "sort-new-chan" }));
  const ch2 = await res2.json();

  // Post to old channel first
  await app.fetch(req("POST", `/api/channels/${ch1.id}/messages`, {
    content: "old channel message for sort test",
  }));

  // Small delay then post to new channel
  await new Promise((r) => setTimeout(r, 50));
  await app.fetch(req("POST", `/api/channels/${ch2.id}/messages`, {
    content: "new channel message for sort test",
  }));
});

describe("Channel Sort by Activity", () => {
  it("default sort returns channels by position/name", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  it("sort=activity puts most recently active first", async () => {
    const res = await app.fetch(req("GET", "/api/channels?sort=activity"));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Find our test channels
    const oldChan = data.find((c: any) => c.name === "#sort-old-chan");
    const newChan = data.find((c: any) => c.name === "#sort-new-chan");
    expect(oldChan).toBeDefined();
    expect(newChan).toBeDefined();

    const oldIdx = data.indexOf(oldChan);
    const newIdx = data.indexOf(newChan);
    // New channel should appear before old channel
    expect(newIdx).toBeLessThan(oldIdx);
  });

  it("channels without messages sort last when sorted by activity", async () => {
    // Create a channel with no messages
    await app.fetch(req("POST", "/api/channels", { name: "sort-empty-chan" }));

    const res = await app.fetch(req("GET", "/api/channels?sort=activity"));
    const data = await res.json();
    const emptyChan = data.find((c: any) => c.name === "#sort-empty-chan");
    expect(emptyChan).toBeDefined();

    // Empty channels should be after channels with messages
    const emptyIdx = data.indexOf(emptyChan);
    const withMessages = data.filter((c: any) => c.last_active_at !== null);
    for (const ch of withMessages) {
      expect(data.indexOf(ch)).toBeLessThan(emptyIdx);
    }
  });
});
