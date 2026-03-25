import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "recent-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channels Recent", () => {
  it("returns 200 with channels array", async () => {
    const res = await app.fetch(req("GET", "/api/channels/recent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.channels)).toBe(true);
    expect(typeof data.count).toBe("number");
  });

  it("channels have last_message_at and message_count", async () => {
    const res = await app.fetch(req("GET", "/api/channels/recent"));
    const data = await res.json();
    if (data.channels.length > 0) {
      const ch = data.channels[0];
      expect(ch.last_message_at).toBeDefined();
      expect(typeof ch.message_count).toBe("number");
      expect(ch.name).toBeDefined();
    }
  });

  it("sorted by most recent message first", async () => {
    const res = await app.fetch(req("GET", "/api/channels/recent"));
    const data = await res.json();
    for (let i = 1; i < data.channels.length; i++) {
      expect(data.channels[i - 1].last_message_at >= data.channels[i].last_message_at).toBe(true);
    }
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/channels/recent?limit=1"));
    const data = await res.json();
    expect(data.channels.length).toBeLessThanOrEqual(1);
  });
});
