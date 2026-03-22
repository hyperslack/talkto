/**
 * Tests for GET /api/members — workspace member list.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "wm-test-user", display_name: "WM User" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Workspace Member List", () => {
  it("GET /api/members returns 200 with members array", async () => {
    const res = await app.fetch(req("GET", "/api/members"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toBeDefined();
    expect(Array.isArray(data.members)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("includes the onboarded user", async () => {
    const res = await app.fetch(req("GET", "/api/members"));
    const data = await res.json();
    const found = data.members.find((m: any) => m.name === "wm-test-user");
    expect(found).toBeDefined();
    expect(found.display_name).toBe("WM User");
    expect(found.type).toBe("human");
  });

  it("each member has required fields", async () => {
    const res = await app.fetch(req("GET", "/api/members"));
    const data = await res.json();
    for (const m of data.members) {
      expect(m.id).toBeDefined();
      expect(m.name).toBeDefined();
      expect(m.type).toBeDefined();
      expect(m.role).toBeDefined();
      expect(m.joined_at).toBeDefined();
    }
  });

  it("count matches members array length", async () => {
    const res = await app.fetch(req("GET", "/api/members"));
    const data = await res.json();
    expect(data.count).toBe(data.members.length);
  });
});
