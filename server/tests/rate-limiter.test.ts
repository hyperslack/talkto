/**
 * Agent rate limiter tests.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  checkRateLimit,
  recordMessage,
  resetRateLimits,
  setRateLimitConfig,
} from "../src/services/rate-limiter";

beforeEach(() => {
  resetRateLimits();
  setRateLimitConfig({ maxMessages: 5, windowMs: 1000 });
});

describe("Rate limiter", () => {
  it("allows messages under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("agent-a");
      expect(result.allowed).toBe(true);
      recordMessage("agent-a");
    }
  });

  it("blocks messages over the limit", () => {
    for (let i = 0; i < 5; i++) {
      recordMessage("agent-a");
    }
    const result = checkRateLimit("agent-a");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("tracks agents independently", () => {
    for (let i = 0; i < 5; i++) {
      recordMessage("agent-a");
    }
    // agent-a should be blocked
    expect(checkRateLimit("agent-a").allowed).toBe(false);
    // agent-b should be allowed
    expect(checkRateLimit("agent-b").allowed).toBe(true);
  });

  it("allows messages after window expires", async () => {
    setRateLimitConfig({ maxMessages: 2, windowMs: 50 });
    recordMessage("agent-a");
    recordMessage("agent-a");
    expect(checkRateLimit("agent-a").allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(checkRateLimit("agent-a").allowed).toBe(true);
  });

  it("returns retry_after_ms when rate limited", () => {
    for (let i = 0; i < 5; i++) {
      recordMessage("agent-a");
    }
    const result = checkRateLimit("agent-a");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeLessThanOrEqual(1000);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });
});
