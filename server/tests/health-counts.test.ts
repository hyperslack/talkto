import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8163";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, { method });
}

describe("Health endpoint counts", () => {
  it("includes member_count and channel_count", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(typeof data.member_count).toBe("number");
    expect(typeof data.channel_count).toBe("number");
    expect(data.member_count).toBeGreaterThanOrEqual(1);
    expect(data.channel_count).toBeGreaterThanOrEqual(1);
  });
});
