import { describe, expect, it, beforeAll } from "bun:test";
import "./test-env";

let app: InstanceType<typeof import("hono").Hono>;

beforeAll(async () => {
  process.env.TALKTO_PORT = "0";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "search-pag-boss", display_name: "Boss" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search Pagination", () => {
  it("returns total and pagination metadata", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=meet"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe("number");
    expect(typeof data.offset).toBe("number");
    expect(typeof data.limit).toBe("number");
    expect(typeof data.has_more).toBe("boolean");
  });

  it("respects offset parameter", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=meet&offset=0&limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(1);
  });

  it("offset beyond results returns empty", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=meet&offset=9999"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.results.length).toBe(0);
  });

  it("has_more is false when all results returned", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=meet&limit=50&offset=0"));
    expect(res.status).toBe(200);
    const data = await res.json();
    if (data.total <= 50) {
      expect(data.has_more).toBe(false);
    }
  });
});
