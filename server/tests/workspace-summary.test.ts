import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "summary-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Workspace Summary", () => {
  it("returns 200 with all summary fields", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total_channels).toBe("number");
    expect(typeof data.total_messages).toBe("number");
    expect(typeof data.messages_last_24h).toBe("number");
    expect(typeof data.total_agents).toBe("number");
    expect(typeof data.total_members).toBe("number");
    expect(typeof data.active_senders_last_24h).toBe("number");
  });

  it("total_channels is at least 1 (#general)", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    expect(data.total_channels).toBeGreaterThanOrEqual(1);
  });

  it("total_messages is non-negative", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    expect(data.total_messages).toBeGreaterThanOrEqual(0);
  });

  it("most_active_channel is present when messages exist", async () => {
    const res = await app.fetch(req("GET", "/api/workspace/summary"));
    const data = await res.json();
    if (data.total_messages > 0) {
      expect(data.most_active_channel).toBeDefined();
    }
  });
});
