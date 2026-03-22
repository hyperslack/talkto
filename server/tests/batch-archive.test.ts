/**
 * Tests for POST /api/channels/batch-archive
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "ba-test-user", display_name: "BA" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Batch Channel Archive", () => {
  it("archives multiple channels at once", async () => {
    // Create test channels
    const ch1Res = await app.fetch(req("POST", "/api/channels", { name: "ba-test-1" }));
    const ch1 = await ch1Res.json();
    const ch2Res = await app.fetch(req("POST", "/api/channels", { name: "ba-test-2" }));
    const ch2 = await ch2Res.json();

    const res = await app.fetch(req("POST", "/api/channels/batch-archive", {
      channel_ids: [ch1.id, ch2.id],
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.archived_count).toBe(2);
    expect(data.archived).toContain(ch1.id);
    expect(data.archived).toContain(ch2.id);
  });

  it("skips #general channel", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const general = channels.find((c: any) => c.name === "#general");

    const res = await app.fetch(req("POST", "/api/channels/batch-archive", {
      channel_ids: [general.id],
    }));
    const data = await res.json();
    expect(data.archived_count).toBe(0);
    expect(data.skipped_count).toBe(1);
    expect(data.skipped[0].reason).toBe("cannot_archive_general");
  });

  it("skips non-existent channels", async () => {
    const res = await app.fetch(req("POST", "/api/channels/batch-archive", {
      channel_ids: ["nonexistent-id"],
    }));
    const data = await res.json();
    expect(data.archived_count).toBe(0);
    expect(data.skipped[0].reason).toBe("not_found");
  });

  it("rejects empty array", async () => {
    const res = await app.fetch(req("POST", "/api/channels/batch-archive", {
      channel_ids: [],
    }));
    expect(res.status).toBe(400);
  });

  it("rejects more than 50 channels", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await app.fetch(req("POST", "/api/channels/batch-archive", {
      channel_ids: ids,
    }));
    expect(res.status).toBe(400);
  });
});
