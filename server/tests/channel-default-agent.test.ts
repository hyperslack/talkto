import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";
import { getDb } from "../src/db";
import { channels, agents } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "default-agent-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Default Agent", () => {
  it("returns 404 for unknown channel (GET)", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/default-agent"));
    expect(res.status).toBe(404);
  });

  it("returns null agent when none set", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("GET", `/api/channels/${general.id}/default-agent`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.default_agent_id).toBeNull();
    expect(data.agent).toBeNull();
  });

  it("can set and get default agent", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    const agent = db.select().from(agents).limit(1).get();
    if (!general || !agent) return;

    // Set
    const setRes = await app.fetch(req("PATCH", `/api/channels/${general.id}/default-agent`, { agent_id: agent.id }));
    expect(setRes.status).toBe(200);
    const setData = await setRes.json();
    expect(setData.default_agent_id).toBe(agent.id);

    // Get
    const getRes = await app.fetch(req("GET", `/api/channels/${general.id}/default-agent`));
    const getData = await getRes.json();
    expect(getData.default_agent_id).toBe(agent.id);
    expect(getData.agent.agent_name).toBe(agent.agentName);
  });

  it("can clear default agent", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("PATCH", `/api/channels/${general.id}/default-agent`, { agent_id: null }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.default_agent_id).toBeNull();
  });

  it("returns 404 for unknown agent_id", async () => {
    const db = getDb();
    const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
    if (!general) return;

    const res = await app.fetch(req("PATCH", `/api/channels/${general.id}/default-agent`, { agent_id: "nonexistent-id" }));
    expect(res.status).toBe(404);
  });
});
