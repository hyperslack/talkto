import { describe, it, expect, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";

let app: Hono;
let sessionCookie: string;

function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  process.env.TALKTO_PORT = "8098";
  const mod = await import("../src/index");
  app = mod.app;

  const onboardRes = await app.fetch(req("POST", "/api/users/onboard", {
    name: "export-test-user",
  }));
  expect(onboardRes.status).toBe(201);
  const setCookie = onboardRes.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/session=([^;]+)/);
  sessionCookie = match ? `session=${match[1]}` : "";
});

describe("Channel Export", () => {
  it("exports messages from a channel as JSON", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = (await chRes.json()) as Array<{ id: string; name: string }>;
    const general = channels.find((c) => c.name === "#general");
    expect(general).toBeDefined();

    // Send a message
    await app.fetch(req("POST", `/api/channels/${general!.id}/messages`, {
      content: "export test msg",
    }));

    const res = await app.fetch(req("GET", `/api/channels/${general!.id}/export`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      channel_id: string;
      channel_name: string;
      exported_at: string;
      message_count: number;
      messages: Array<{ content: string; sender_name: string }>;
    };
    expect(data.channel_name).toBe("#general");
    expect(data.message_count).toBeGreaterThan(0);
    expect(data.exported_at).toBeTruthy();
  });

  it("returns 404 for non-existent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent-id/export"));
    expect(res.status).toBe(404);
  });

  it("respects limit parameter", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = (await chRes.json()) as Array<{ id: string; name: string }>;
    const general = channels.find((c) => c.name === "#general")!;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/export?limit=1`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { message_count: number };
    expect(data.message_count).toBeLessThanOrEqual(1);
  });

  it("exported messages include required fields", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = (await chRes.json()) as Array<{ id: string; name: string }>;
    const general = channels.find((c) => c.name === "#general")!;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/export`));
    const data = (await res.json()) as {
      messages: Array<{ sender_name: string; content: string; created_at: string }>;
    };
    for (const msg of data.messages) {
      expect(typeof msg.sender_name).toBe("string");
      expect(typeof msg.content).toBe("string");
      expect(typeof msg.created_at).toBe("string");
    }
  });
});
