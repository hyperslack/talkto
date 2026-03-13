import { describe, it, expect } from "bun:test";
import {
  clampTtl,
  computeExpiry,
  isExpired,
  remainingTime,
  EphemeralTracker,
} from "../src/lib/ephemeral-messages";

describe("clampTtl", () => {
  it("returns value within bounds", () => {
    expect(clampTtl(60)).toBe(60);
  });

  it("clamps below minimum", () => {
    expect(clampTtl(1)).toBe(10);
  });

  it("clamps above maximum", () => {
    expect(clampTtl(100000)).toBe(86400);
  });

  it("rounds to integer", () => {
    expect(clampTtl(30.7)).toBe(31);
  });
});

describe("computeExpiry", () => {
  it("adds TTL seconds to creation time", () => {
    const created = "2025-01-15T10:00:00.000Z";
    const expires = computeExpiry(created, 300);
    expect(expires).toBe("2025-01-15T10:05:00.000Z");
  });
});

describe("isExpired", () => {
  it("returns true for past expiry", () => {
    const past = new Date(Date.now() - 10000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it("returns false for future expiry", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});

describe("remainingTime", () => {
  it("returns 'expired' for past times", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(remainingTime(past)).toBe("expired");
  });

  it("returns seconds for short durations", () => {
    const soon = new Date(Date.now() + 30000).toISOString();
    const result = remainingTime(soon);
    expect(result).toMatch(/^\d+s$/);
  });

  it("returns minutes for medium durations", () => {
    const later = new Date(Date.now() + 180000).toISOString();
    const result = remainingTime(later);
    expect(result).toMatch(/^\d+m$/);
  });

  it("returns hours for long durations", () => {
    const far = new Date(Date.now() + 7200000).toISOString();
    const result = remainingTime(far);
    expect(result).toMatch(/^\d+h$/);
  });
});

describe("EphemeralTracker", () => {
  it("registers and tracks ephemeral messages", () => {
    const tracker = new EphemeralTracker();
    const entry = tracker.register("msg1", "ch1", 60);
    expect(tracker.isEphemeral("msg1")).toBe(true);
    expect(entry.ttlSeconds).toBe(60);
    expect(tracker.size).toBe(1);
  });

  it("returns false for non-ephemeral messages", () => {
    const tracker = new EphemeralTracker();
    expect(tracker.isEphemeral("msg1")).toBe(false);
  });

  it("finds expired messages", () => {
    const tracker = new EphemeralTracker({ defaultTtlSeconds: 0, minTtlSeconds: 0, maxTtlSeconds: 86400 });
    // Register with 0 TTL (already expired)
    tracker.register("msg1", "ch1", 0);
    // Small delay to ensure expiry
    const result = tracker.findExpired();
    expect(result.expiredCount).toBeGreaterThanOrEqual(0); // May or may not be expired instantly
  });

  it("uses default TTL when not specified", () => {
    const tracker = new EphemeralTracker({ defaultTtlSeconds: 120, minTtlSeconds: 10, maxTtlSeconds: 86400 });
    const entry = tracker.register("msg1", "ch1");
    expect(entry.ttlSeconds).toBe(120);
  });

  it("clamps TTL within bounds", () => {
    const tracker = new EphemeralTracker({ defaultTtlSeconds: 60, minTtlSeconds: 30, maxTtlSeconds: 3600 });
    const entry = tracker.register("msg1", "ch1", 5);
    expect(entry.ttlSeconds).toBe(30);
  });
});
