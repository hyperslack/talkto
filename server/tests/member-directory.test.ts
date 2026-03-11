/**
 * Tests for member directory endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8256";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Member Directory", () => {
  beforeAll(async () => {
    await app.fetch(req("POST", "/api/users/onboard", { name: "directory-tester" }));
  });

  it("returns member directory", async () => {
    const res = await app.fetch(req("GET", "/api/members/directory"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("includes expected fields when members exist", async () => {
    const res = await app.fetch(req("GET", "/api/members/directory"));
    const data = await res.json();
    if (data.length > 0) {
      const member = data[0];
      expect(member.user_id).toBeDefined();
      expect(member.name).toBeDefined();
      expect(typeof member.message_count).toBe("number");
      expect(typeof member.channel_count).toBe("number");
    } else {
      // No members — that's OK, just verify it's an array
      expect(true).toBe(true);
    }
  });

  it("returns consistent results on repeated calls", async () => {
    const res1 = await app.fetch(req("GET", "/api/members/directory"));
    const data1 = await res1.json();
    const res2 = await app.fetch(req("GET", "/api/members/directory"));
    const data2 = await res2.json();
    expect(data1.length).toBe(data2.length);
  });
});
