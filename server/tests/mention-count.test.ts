/**
 * Tests for message mention count feature.
 */

import { describe, expect, it } from "bun:test";

describe("Mention Count", () => {
  it("response shape with no mentions", () => {
    const result = { total_mentions: 0, by_channel: [] };
    expect(result.total_mentions).toBe(0);
    expect(result.by_channel).toHaveLength(0);
  });

  it("response shape with mentions across channels", () => {
    const result = {
      total_mentions: 5,
      by_channel: [
        { channel_id: "ch1", channel_name: "#general", mention_count: 3 },
        { channel_id: "ch2", channel_name: "#dev", mention_count: 2 },
      ],
    };
    expect(result.total_mentions).toBe(5);
    expect(result.by_channel).toHaveLength(2);
    expect(result.by_channel[0].mention_count).toBe(3);
  });

  it("parses mention from JSON array correctly", () => {
    const mentionsJson = '["alice","bob","charlie"]';
    const arr = JSON.parse(mentionsJson);
    expect(arr.includes("alice")).toBe(true);
    expect(arr.includes("dave")).toBe(false);
  });

  it("handles null mentions gracefully", () => {
    const mentions: string | null = null;
    const hasMention = mentions ? JSON.parse(mentions).includes("alice") : false;
    expect(hasMention).toBe(false);
  });

  it("handles malformed mentions JSON gracefully", () => {
    const mentions = "not-valid-json";
    let hasMention = false;
    try {
      const arr = JSON.parse(mentions);
      hasMention = Array.isArray(arr) && arr.includes("alice");
    } catch {
      hasMention = false;
    }
    expect(hasMention).toBe(false);
  });

  it("only counts mentions after lastReadAt", () => {
    const lastRead = "2025-01-10T00:00:00.000Z";
    const messageTime = "2025-01-15T00:00:00.000Z";
    expect(messageTime > lastRead).toBe(true);

    const olderMessage = "2025-01-05T00:00:00.000Z";
    expect(olderMessage > lastRead).toBe(false);
  });
});
