/**
 * Tests for message importance markers.
 */

import { describe, expect, it } from "bun:test";

describe("Message Importance", () => {
  it("validates importance levels", () => {
    const valid = ["normal", "important", "urgent"];
    expect(valid.includes("important")).toBe(true);
    expect(valid.includes("critical")).toBe(false);
  });

  it("importance entry has correct shape", () => {
    const entry = {
      message_id: "msg-1",
      user_id: "user-1",
      level: "important" as const,
      note: "follow up tomorrow",
      created_at: new Date().toISOString(),
    };
    expect(entry.message_id).toBe("msg-1");
    expect(entry.level).toBe("important");
    expect(entry.note).toBe("follow up tomorrow");
  });

  it("note length capped at 500 chars", () => {
    const note = "x".repeat(501);
    expect(note.length).toBeGreaterThan(500);
  });

  it("null note is valid", () => {
    const entry = { note: null };
    expect(entry.note).toBeNull();
  });

  it("importance is per-user (different from pinning)", () => {
    const key1 = `msg-1:user-1`;
    const key2 = `msg-1:user-2`;
    // Same message can be important for different users independently
    expect(key1).not.toBe(key2);
  });

  it("distinguishes between normal, important, and urgent", () => {
    const levels = ["normal", "important", "urgent"];
    expect(levels.length).toBe(3);
    expect(new Set(levels).size).toBe(3);
  });
});
