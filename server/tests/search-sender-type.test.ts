/**
 * Tests for search sender_type filter.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";
import { getDb } from "../src/db";
import { agents, users } from "../src/db/schema";
import { eq } from "drizzle-orm";

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
    name: "search-type-boss",
    display_name: "Search Type Boss",
  }));

  // Send a human message
  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  const generalId = channels.find((c: any) => c.name === "#general")?.id;

  await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
    content: "sender-type-filter-test human message unique42",
  }));

  // Create an agent and send a message from it
  const db = getDb();
  const agentUserId = crypto.randomUUID();
  db.insert(users).values({
    id: agentUserId,
    name: "search-agent-bot",
    type: "agent",
    createdAt: new Date().toISOString(),
  }).run();

  const { messages } = await import("../src/db/schema");
  db.insert(messages).values({
    id: crypto.randomUUID(),
    channelId: generalId,
    senderId: agentUserId,
    content: "sender-type-filter-test agent message unique42",
    createdAt: new Date().toISOString(),
  }).run();
});

describe("Search sender_type filter", () => {
  it("returns all results without filter", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=sender-type-filter-test"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by sender_type=human", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=sender-type-filter-test&sender_type=human"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    for (const r of data.results) {
      expect(r.sender_type).toBe("human");
    }
  });

  it("filters by sender_type=agent", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=sender-type-filter-test&sender_type=agent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    for (const r of data.results) {
      expect(r.sender_type).toBe("agent");
    }
  });

  it("ignores invalid sender_type values", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=sender-type-filter-test&sender_type=invalid"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Should return all results (filter not applied)
    expect(data.results.length).toBeGreaterThanOrEqual(2);
  });
});
