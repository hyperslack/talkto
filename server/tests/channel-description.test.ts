/**
 * Tests for channel description endpoint.
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
    name: "desc-test-user",
    display_name: "Desc Tester",
  }));

  // Create a test channel
  const res = await app.fetch(req("POST", "/api/channels", { name: "desc-test-chan" }));
  const data = await res.json();
  channelId = data.id;
});

describe("Channel Description", () => {
  it("returns null description by default", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("sets a channel description", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "This channel is for testing descriptions",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("This channel is for testing descriptions");
  });

  it("clears description with null", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: null,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("clears description with empty string", async () => {
    // First set it
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "temp",
      })
    );
    // Then clear with empty string
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBeNull();
  });

  it("rejects descriptions over 2000 chars", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "x".repeat(2001),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent-id/description", {
        description: "test",
      })
    );
    expect(res.status).toBe(404);
  });

  it("includes description in channel list", async () => {
    await app.fetch(
      req("PATCH", `/api/channels/${channelId}/description`, {
        description: "Listed description",
      })
    );
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    const chan = channels.find((c: any) => c.id === channelId);
    expect(chan.description).toBe("Listed description");
  });
});
