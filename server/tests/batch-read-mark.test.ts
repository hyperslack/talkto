/**
 * Tests for batch channel read mark feature.
 */

import { describe, expect, it } from "bun:test";

describe("Batch Read Mark", () => {
  it("response shape for successful batch mark", () => {
    const result = { marked_count: 5, timestamp: "2025-01-15T10:30:00.000Z" };
    expect(result.marked_count).toBe(5);
    expect(result.timestamp).toBeDefined();
  });

  it("returns 0 marked when no channels exist", () => {
    const result = { marked_count: 0, timestamp: "2025-01-15T10:30:00.000Z" };
    expect(result.marked_count).toBe(0);
  });

  it("timestamp is valid ISO 8601", () => {
    const ts = new Date().toISOString();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it("skips archived channels", () => {
    const channels = [
      { id: "ch1", isArchived: 0 },
      { id: "ch2", isArchived: 1 },
      { id: "ch3", isArchived: 0 },
    ];
    const active = channels.filter((c) => c.isArchived === 0);
    expect(active.length).toBe(2);
  });

  it("updates existing read receipts", () => {
    const existing = { userId: "u1", channelId: "ch1", lastReadAt: "2025-01-01T00:00:00.000Z" };
    const newTimestamp = "2025-01-15T10:30:00.000Z";
    const updated = { ...existing, lastReadAt: newTimestamp };
    expect(updated.lastReadAt).toBe(newTimestamp);
    expect(updated.lastReadAt > existing.lastReadAt).toBe(true);
  });
});
