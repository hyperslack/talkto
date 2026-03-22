/**
 * Tests for GET /api/activity/hourly — hourly message volume.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;
let generalId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "hv-test-user", display_name: "HV" }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  generalId = channels.find((c: any) => c.name === "#general").id;

  // Post a message to have data
  await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
    content: "hv test message unique-hv-1",
  }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Hourly Message Volume", () => {
  it("GET /api/activity/hourly returns 200 with volume array", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hours).toBe(24);
    expect(data.volume).toBeDefined();
    expect(Array.isArray(data.volume)).toBe(true);
  });

  it("includes data for current hour", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly"));
    const data = await res.json();
    expect(data.volume.length).toBeGreaterThanOrEqual(1);
    expect(data.volume[0].hour).toBeDefined();
    expect(data.volume[0].message_count).toBeGreaterThanOrEqual(1);
  });

  it("respects hours parameter", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly?hours=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hours).toBe(1);
  });

  it("caps hours at 168", async () => {
    const res = await app.fetch(req("GET", "/api/activity/hourly?hours=999"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hours).toBe(168);
  });
});
