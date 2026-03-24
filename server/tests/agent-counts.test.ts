/**
 * Tests for agent status counts endpoint.
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
    name: "counts-test-user",
    display_name: "Counts Tester",
  }));
});

describe("Agent Counts", () => {
  it("returns count fields", async () => {
    const res = await app.fetch(req("GET", "/api/agents/counts"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe("number");
    expect(typeof data.online).toBe("number");
    expect(typeof data.offline).toBe("number");
    expect(data.total).toBe(data.online + data.offline);
  });

  it("includes by_type breakdown", async () => {
    const res = await app.fetch(req("GET", "/api/agents/counts"));
    const data = await res.json();
    expect(typeof data.by_type).toBe("object");

    // Sum of by_type should equal total
    const typeSum = Object.values(data.by_type as Record<string, number>).reduce(
      (a: number, b: number) => a + b, 0
    );
    expect(typeSum).toBe(data.total);
  });

  it("total matches agents list length", async () => {
    const countsRes = await app.fetch(req("GET", "/api/agents/counts"));
    const counts = await countsRes.json();

    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();

    expect(counts.total).toBe(agents.length);
  });
});
