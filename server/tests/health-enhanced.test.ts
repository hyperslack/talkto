/**
 * Tests for enhanced health endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8157";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Enhanced Health Endpoint", () => {
  it("returns status ok", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("includes version", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    const data = await res.json();
    expect(data.version).toBe("0.1.0");
  });

  it("includes ws_clients count", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    const data = await res.json();
    expect(typeof data.ws_clients).toBe("number");
    expect(data.ws_clients).toBeGreaterThanOrEqual(0);
  });

  it("includes uptime_seconds", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    const data = await res.json();
    expect(typeof data.uptime_seconds).toBe("number");
    expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});
