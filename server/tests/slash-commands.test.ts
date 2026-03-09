/**
 * Tests for slash commands.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { parseSlashCommand, listSlashCommands } from "../src/services/slash-commands";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8204";
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

describe("Slash Commands — Parser", () => {
  it("parses /shrug without args", () => {
    const result = parseSlashCommand("/shrug", "Alice");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("¯\\_(ツ)_/¯");
    expect(result!.recognized).toBe(true);
  });

  it("parses /shrug with args", () => {
    const result = parseSlashCommand("/shrug oh well", "Alice");
    expect(result!.content).toBe("oh well ¯\\_(ツ)_/¯");
  });

  it("parses /me with action", () => {
    const result = parseSlashCommand("/me waves hello", "Bob");
    expect(result!.content).toBe("_Bob waves hello_");
  });

  it("returns error for /me without args", () => {
    const result = parseSlashCommand("/me", "Bob");
    expect(result!.error).toBeDefined();
    expect(result!.content).toBeNull();
  });

  it("returns null for non-slash messages", () => {
    expect(parseSlashCommand("hello world", "Alice")).toBeNull();
  });

  it("returns unrecognized for unknown commands", () => {
    const result = parseSlashCommand("/unknown", "Alice");
    expect(result!.recognized).toBe(false);
  });

  it("parses /tableflip", () => {
    const result = parseSlashCommand("/tableflip", "Alice");
    expect(result!.content).toContain("┻━┻");
  });

  it("parses /lenny", () => {
    const result = parseSlashCommand("/lenny", "Alice");
    expect(result!.content).toBe("( ͡° ͜ʖ ͡°)");
  });
});

describe("Slash Commands — API", () => {
  it("lists available commands", async () => {
    const res = await app.fetch(req("GET", "/api/slash-commands"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(5);
    expect(data[0].command).toBeDefined();
    expect(data[0].description).toBeDefined();
  });

  it("transforms /shrug in message posting", async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `slash-test-${Date.now()}` })
    );
    const ch = await chRes.json();

    const msgRes = await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "/shrug" })
    );
    expect(msgRes.status).toBe(201);
    const msg = await msgRes.json();
    expect(msg.content).toBe("¯\\_(ツ)_/¯");
  });

  it("rejects unknown slash commands", async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `slash-unk-${Date.now()}` })
    );
    const ch = await chRes.json();

    const msgRes = await app.fetch(
      req("POST", `/api/channels/${ch.id}/messages`, { content: "/notacommand" })
    );
    expect(msgRes.status).toBe(400);
  });
});
