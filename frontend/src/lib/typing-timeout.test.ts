import { describe, it, expect } from "bun:test";
import {
  findStaleEntries,
  createTypingEntry,
  isStale,
  DEFAULT_TYPING_TIMEOUT_MS,
} from "./typing-timeout";

describe("typing-timeout", () => {
  it("creates a typing entry with current timestamp", () => {
    const before = Date.now();
    const entry = createTypingEntry("bot1", "ch1");
    expect(entry.agentName).toBe("bot1");
    expect(entry.channelId).toBe("ch1");
    expect(entry.startedAt).toBeGreaterThanOrEqual(before);
  });

  it("detects stale entries past timeout", () => {
    const now = 100_000;
    const entry = { agentName: "bot1", channelId: "ch1", startedAt: now - 31_000 };
    expect(isStale(entry, now)).toBe(true);
  });

  it("does not flag fresh entries as stale", () => {
    const now = 100_000;
    const entry = { agentName: "bot1", channelId: "ch1", startedAt: now - 5_000 };
    expect(isStale(entry, now)).toBe(false);
  });

  it("findStaleEntries filters correctly", () => {
    const now = 100_000;
    const entries = [
      { agentName: "bot1", channelId: "ch1", startedAt: now - 31_000 },
      { agentName: "bot2", channelId: "ch1", startedAt: now - 1_000 },
      { agentName: "bot3", channelId: "ch2", startedAt: now - 50_000 },
    ];
    const stale = findStaleEntries(entries, now);
    expect(stale).toHaveLength(2);
    expect(stale.map((e) => e.agentName).sort()).toEqual(["bot1", "bot3"]);
  });

  it("supports custom timeout", () => {
    const now = 100_000;
    const entry = { agentName: "bot1", channelId: "ch1", startedAt: now - 5_000 };
    expect(isStale(entry, now, 3_000)).toBe(true);
    expect(isStale(entry, now, 10_000)).toBe(false);
  });

  it("DEFAULT_TYPING_TIMEOUT_MS is 30 seconds", () => {
    expect(DEFAULT_TYPING_TIMEOUT_MS).toBe(30_000);
  });
});
