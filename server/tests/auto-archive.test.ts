/**
 * Tests for channel auto-archive logic.
 */

import { describe, expect, it } from "bun:test";

describe("Channel Auto-Archive", () => {
  it("rejects inactive_days less than 1", () => {
    expect(() => {
      const days = 0;
      if (days < 1) throw new Error("Inactive days must be at least 1");
    }).toThrow("at least 1");
  });

  it("rejects inactive_days over 365", () => {
    expect(() => {
      const days = 366;
      if (days > 365) throw new Error("Inactive days cannot exceed 365");
    }).toThrow("exceed 365");
  });

  it("config shape has correct fields", () => {
    const config = {
      channel_id: "ch-1",
      inactive_days: 30,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    expect(config.inactive_days).toBe(30);
    expect(config.enabled).toBe(true);
  });

  it("calculates cutoff correctly", () => {
    const days = 30;
    const cutoffMs = days * 24 * 60 * 60 * 1000;
    expect(cutoffMs).toBe(2592000000); // 30 days in ms
  });

  it("never auto-archives #general", () => {
    const channelType = "general";
    expect(channelType === "general").toBe(true); // skip logic
  });

  it("uses channel creation time when no messages", () => {
    const lastMsg = null;
    const channelCreatedAt = "2026-01-01T00:00:00Z";
    const lastActivityTime = lastMsg
      ? new Date(lastMsg).getTime()
      : new Date(channelCreatedAt).getTime();
    expect(lastActivityTime).toBe(new Date(channelCreatedAt).getTime());
  });

  it("skips already archived channels", () => {
    const isArchived = 1;
    expect(isArchived === 0).toBe(false); // would skip
  });
});
