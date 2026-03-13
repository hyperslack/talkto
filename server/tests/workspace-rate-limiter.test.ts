import { describe, it, expect } from "bun:test";
import { WorkspaceRateLimiter } from "../src/lib/workspace-rate-limiter";

describe("WorkspaceRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 5, globalLimit: 10, windowMs: 60_000 });
    const result = limiter.check("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.scope).toBeNull();
  });

  it("blocks user exceeding per-user limit", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 3, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    const result = limiter.check("user1");
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe("user");
    expect(result.retryAfterMs).not.toBeNull();
  });

  it("blocks when global limit exceeded", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 100, globalLimit: 2, windowMs: 60_000 });
    limiter.check("user1");
    limiter.check("user2");
    const result = limiter.check("user3");
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe("global");
  });

  it("allows different users independently", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 2, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    limiter.check("user1");
    const result = limiter.check("user2");
    expect(result.allowed).toBe(true);
  });

  it("tracks stats correctly", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 10, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    limiter.check("user2");
    limiter.check("user1");
    const stats = limiter.stats();
    expect(stats.globalUsage).toBe(3);
    expect(stats.userCount).toBe(2);
  });

  it("tracks per-user usage", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 10, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.userUsage("user1")).toBe(2);
    expect(limiter.userUsage("user2")).toBe(0);
  });

  it("resets all counters", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 10, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    limiter.reset();
    expect(limiter.stats().globalUsage).toBe(0);
    expect(limiter.userUsage("user1")).toBe(0);
  });

  it("updates config dynamically", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 1, globalLimit: 100, windowMs: 60_000 });
    limiter.check("user1");
    expect(limiter.check("user1").allowed).toBe(false);
    limiter.updateConfig({ perUserLimit: 10 });
    expect(limiter.check("user1").allowed).toBe(true);
  });

  it("returns retry-after in milliseconds", () => {
    const limiter = new WorkspaceRateLimiter({ perUserLimit: 1, globalLimit: 100, windowMs: 5000 });
    limiter.check("user1");
    const result = limiter.check("user1");
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs!).toBeLessThanOrEqual(5000);
  });
});
