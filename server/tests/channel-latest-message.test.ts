/**
 * Tests for GET /api/channels/:channelId/latest-message
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;
let generalId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "clm-test-user", display_name: "CLM" }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  generalId = channels.find((c: any) => c.name === "#general").id;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Latest Message", () => {
  it("returns null when no messages exist", async () => {
    // Create a fresh empty channel
    const chRes = await app.fetch(req("POST", "/api/channels", { name: "empty-clm-test" }));
    const ch = await chRes.json();
    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/latest-message`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeNull();
  });

  it("returns the latest message after posting", async () => {
    await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
      content: "clm latest test message unique-clm-1",
    }));

    const res = await app.fetch(req("GET", `/api/channels/${generalId}/latest-message`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.message.content).toBe("clm latest test message unique-clm-1");
    expect(data.message.sender_name).toBeDefined();
    expect(data.message.sender_type).toBeDefined();
  });

  it("returns 404 for invalid channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/latest-message"));
    expect(res.status).toBe(404);
  });

  it("returns most recent message, not older ones", async () => {
    await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
      content: "clm older message unique-clm-2",
    }));
    await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
      content: "clm newest message unique-clm-3",
    }));

    const res = await app.fetch(req("GET", `/api/channels/${generalId}/latest-message`));
    const data = await res.json();
    expect(data.message.content).toBe("clm newest message unique-clm-3");
  });
});
