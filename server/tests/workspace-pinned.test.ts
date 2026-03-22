/**
 * Tests for GET /api/pinned — workspace-wide pinned messages.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;

  await app.fetch(req("POST", "/api/users/onboard", { name: "pinned-test-user", display_name: "Pinner" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Workspace Pinned Messages", () => {
  it("GET /api/pinned returns empty when no pins exist", async () => {
    const res = await app.fetch(req("GET", "/api/pinned"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.count).toBe(0);
  });

  it("GET /api/pinned returns pinned messages across channels", async () => {
    // Get channels
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const general = channels.find((c: any) => c.name === "#general");

    // Post a message
    const msgRes = await app.fetch(req("POST", `/api/channels/${general.id}/messages`, {
      content: "workspace pinned test message unique-wpt-1",
    }));
    const msg = await msgRes.json();

    // Pin it
    await app.fetch(req("POST", `/api/channels/${general.id}/messages/${msg.id}/pin`));

    // Check workspace pins
    const res = await app.fetch(req("GET", "/api/pinned"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
    const found = data.results.find((r: any) => r.id === msg.id);
    expect(found).toBeDefined();
    expect(found.channel_name).toBe("#general");
    expect(found.pinned_at).toBeDefined();
  });

  it("GET /api/pinned respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/pinned?limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeLessThanOrEqual(1);
  });

  it("GET /api/pinned includes sender info", async () => {
    const res = await app.fetch(req("GET", "/api/pinned"));
    const data = await res.json();
    if (data.results.length > 0) {
      const pin = data.results[0];
      expect(pin.sender_id).toBeDefined();
      expect(pin.sender_name).toBeDefined();
      expect(pin.sender_type).toBeDefined();
    }
  });
});
