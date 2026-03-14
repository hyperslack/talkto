import { describe, expect, test } from "bun:test";
import {
  InvocationCooldownTracker,
  formatCooldown,
} from "../src/utils/agent-invocation-cooldown";

const NOW = 1700000000000;

describe("InvocationCooldownTracker", () => {
  test("first invocation is always allowed", () => {
    const tracker = new InvocationCooldownTracker();
    const result = tracker.check("user1", "claude", NOW);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  test("second invocation within cooldown is blocked", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    tracker.check("user1", "claude", NOW);
    const result = tracker.check("user1", "claude", NOW + 5000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(5000);
  });

  test("invocation after cooldown expires is allowed", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    tracker.check("user1", "claude", NOW);
    const result = tracker.check("user1", "claude", NOW + 11_000);
    expect(result.allowed).toBe(true);
  });

  test("cooldowns are per user-agent pair", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    tracker.check("user1", "claude", NOW);
    // Different agent, same user
    expect(tracker.check("user1", "gpt", NOW + 1000).allowed).toBe(true);
    // Different user, same agent
    expect(tracker.check("user2", "claude", NOW + 1000).allowed).toBe(true);
  });

  test("respects per-agent cooldown overrides", () => {
    const overrides = new Map([["slow-agent", 60_000]]);
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000, agentOverrides: overrides });
    tracker.check("user1", "slow-agent", NOW);
    const result = tracker.check("user1", "slow-agent", NOW + 15_000);
    expect(result.allowed).toBe(false); // still in 60s cooldown
  });

  test("setAgentCooldown updates override", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    tracker.setAgentCooldown("claude", 30_000);
    tracker.check("user1", "claude", NOW);
    expect(tracker.check("user1", "claude", NOW + 15_000).allowed).toBe(false);
  });

  test("reset clears specific cooldown", () => {
    const tracker = new InvocationCooldownTracker();
    tracker.check("user1", "claude", NOW);
    tracker.reset("user1", "claude");
    expect(tracker.check("user1", "claude", NOW + 1).allowed).toBe(true);
  });

  test("resetUser clears all cooldowns for user", () => {
    const tracker = new InvocationCooldownTracker();
    tracker.check("user1", "claude", NOW);
    tracker.check("user1", "gpt", NOW);
    const cleared = tracker.resetUser("user1");
    expect(cleared).toBe(2);
    expect(tracker.size).toBe(0);
  });

  test("purgeExpired removes old entries", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    tracker.check("user1", "claude", NOW);
    tracker.check("user2", "gpt", NOW + 5_000);
    const purged = tracker.purgeExpired(NOW + 12_000);
    expect(purged).toBe(1); // only user1's expired
    expect(tracker.size).toBe(1);
  });

  test("expiresAt is set correctly", () => {
    const tracker = new InvocationCooldownTracker({ defaultMs: 10_000 });
    const result = tracker.check("user1", "claude", NOW);
    expect(result.expiresAt).toBe(NOW + 10_000);
  });
});

describe("formatCooldown", () => {
  test("formats seconds", () => {
    expect(formatCooldown(5000)).toBe("5s");
    expect(formatCooldown(500)).toBe("1s");
  });

  test("formats minutes", () => {
    expect(formatCooldown(120_000)).toBe("2m");
  });

  test("ready when 0 or negative", () => {
    expect(formatCooldown(0)).toBe("ready");
    expect(formatCooldown(-1)).toBe("ready");
  });
});
