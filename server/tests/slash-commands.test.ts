/**
 * Tests for slash command registry endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8168";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Slash Commands", () => {
  it("lists built-in commands", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(5);
    const help = data.find((c: any) => c.name === "/help");
    expect(help).toBeDefined();
    expect(help.description).toBeDefined();
  });

  it("filters by category", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands?category=channel"));
    const data = await res.json();
    for (const cmd of data) {
      expect(cmd.category).toBe("channel");
    }
  });

  it("gets a specific command", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands/help"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("/help");
  });

  it("returns 404 for unknown command", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands/nonexistent"));
    expect(res.status).toBe(404);
  });

  it("registers a custom command", async () => {
    const res = await app.fetch(
      req("POST", "/api/slash-commands", {
        name: "/deploy",
        description: "Deploy the current project",
        usage: "/deploy [environment]",
        category: "devops",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("/deploy");
    expect(data.category).toBe("devops");
  });

  it("rejects duplicate command name", async () => {
    const res = await app.fetch(
      req("POST", "/api/slash-commands", {
        name: "/deploy",
        description: "Another deploy",
      })
    );
    expect(res.status).toBe(409);
  });

  it("rejects invalid command name", async () => {
    const res = await app.fetch(
      req("POST", "/api/slash-commands", {
        name: "no-slash",
        description: "Missing slash prefix",
      })
    );
    expect(res.status).toBe(400);
  });

  it("custom command appears in list", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands"));
    const data = await res.json();
    const deploy = data.find((c: any) => c.name === "/deploy");
    expect(deploy).toBeDefined();
  });
});
