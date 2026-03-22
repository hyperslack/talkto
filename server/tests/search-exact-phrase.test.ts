/**
 * Tests for GET /api/search?exact=true — exact phrase matching.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: any;
let generalId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "sep-test-user", display_name: "SEP" }));

  const chRes = await app.fetch(req("GET", "/api/channels"));
  const channels = await chRes.json();
  generalId = channels.find((c: any) => c.name === "#general").id;

  // Post messages with mixed case
  await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
    content: "Hello World sep-unique-1",
  }));
  await app.fetch(req("POST", `/api/channels/${generalId}/messages`, {
    content: "hello world sep-unique-2",
  }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search Exact Phrase", () => {
  it("default search is case-insensitive", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=hello+world"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exact).toBe(false);
    // Should match both "Hello World" and "hello world"
    const sepResults = data.results.filter((r: any) => r.content.includes("sep-unique"));
    expect(sepResults.length).toBe(2);
  });

  it("exact=true is case-sensitive", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=Hello+World&exact=true"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exact).toBe(true);
    // Should only match "Hello World" (uppercase H, W)
    const sepResults = data.results.filter((r: any) => r.content.includes("sep-unique"));
    expect(sepResults.length).toBe(1);
    expect(sepResults[0].content).toContain("Hello World");
  });

  it("exact flag appears in response", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=test&exact=true"));
    const data = await res.json();
    expect(data.exact).toBe(true);
  });

  it("without exact flag defaults to false", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=test"));
    const data = await res.json();
    expect(data.exact).toBe(false);
  });
});
