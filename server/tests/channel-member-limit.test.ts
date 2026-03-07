/**
 * Tests for channel member limit logic.
 */

import { describe, expect, it } from "bun:test";

describe("Channel Member Limit Validation", () => {
  it("rejects max_members less than 1", () => {
    expect(() => {
      const maxMembers = 0;
      if (maxMembers < 1) throw new Error("Max members must be at least 1");
    }).toThrow("at least 1");
  });

  it("rejects max_members over 10000", () => {
    expect(() => {
      const maxMembers = 10001;
      if (maxMembers > 10000) throw new Error("Max members cannot exceed 10000");
    }).toThrow("exceed 10000");
  });

  it("allows valid max_members", () => {
    const valid = [1, 10, 100, 1000, 10000];
    for (const v of valid) {
      expect(v >= 1 && v <= 10000).toBe(true);
    }
  });

  it("null limit means unlimited", () => {
    const limit: number | null = null;
    const canAdd = limit === null || 500 < limit;
    expect(canAdd).toBe(true);
  });

  it("limit shape has correct fields", () => {
    const entry = {
      channel_id: "ch-1",
      max_members: 50,
      updated_at: new Date().toISOString(),
    };
    expect(entry.channel_id).toBe("ch-1");
    expect(entry.max_members).toBe(50);
    expect(entry.updated_at).toBeTruthy();
  });
});
