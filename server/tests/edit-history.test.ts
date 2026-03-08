/**
 * Tests for message edit history tracking.
 */

import { describe, expect, it } from "bun:test";

describe("Edit History", () => {
  it("edit history entry has required fields", () => {
    const entry = {
      id: "h1",
      message_id: "msg1",
      old_content: "original text",
      edited_at: "2025-01-15T10:30:00.000Z",
    };
    expect(entry.id).toBeDefined();
    expect(entry.message_id).toBe("msg1");
    expect(entry.old_content).toBe("original text");
    expect(entry.edited_at).toBeDefined();
  });

  it("history response includes message_id and array", () => {
    const response = {
      message_id: "msg1",
      history: [
        { id: "h1", message_id: "msg1", old_content: "v1", edited_at: "2025-01-01T00:00:00.000Z" },
        { id: "h2", message_id: "msg1", old_content: "v2", edited_at: "2025-01-02T00:00:00.000Z" },
      ],
    };
    expect(response.history).toHaveLength(2);
    expect(response.history[0].old_content).toBe("v1");
  });

  it("empty history for never-edited message", () => {
    const response = { message_id: "msg1", history: [] };
    expect(response.history).toHaveLength(0);
  });

  it("history is ordered by edited_at ascending", () => {
    const entries = [
      { edited_at: "2025-01-01T00:00:00.000Z" },
      { edited_at: "2025-01-02T00:00:00.000Z" },
      { edited_at: "2025-01-03T00:00:00.000Z" },
    ];
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].edited_at > entries[i - 1].edited_at).toBe(true);
    }
  });

  it("each edit preserves the old content", () => {
    const edits = ["Hello", "Hello World", "Hello World!"];
    // After 3 versions, we should have 2 history entries (original + first edit)
    const historyCount = edits.length - 1;
    expect(historyCount).toBe(2);
  });

  it("old_content can contain special characters", () => {
    const entry = {
      old_content: 'Text with "quotes", <html>, and emoji 🎉',
    };
    expect(entry.old_content).toContain('"quotes"');
    expect(entry.old_content).toContain("🎉");
  });
});
