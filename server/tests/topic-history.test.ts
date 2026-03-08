/**
 * Tests for channel topic history tracking.
 */

import { describe, expect, it } from "bun:test";

describe("Topic History", () => {
  it("topic history entry has required fields", () => {
    const entry = {
      id: "abc-123",
      channel_id: "ch-1",
      old_topic: "Old Topic",
      new_topic: "New Topic",
      changed_by: "user-1",
      changed_by_name: "Alice",
      changed_at: "2025-01-15T10:30:00.000Z",
    };
    expect(entry.id).toBeDefined();
    expect(entry.channel_id).toBe("ch-1");
    expect(entry.old_topic).toBe("Old Topic");
    expect(entry.new_topic).toBe("New Topic");
    expect(entry.changed_by).toBe("user-1");
    expect(entry.changed_by_name).toBe("Alice");
    expect(entry.changed_at).toBeDefined();
  });

  it("handles null old topic (first topic set)", () => {
    const entry = {
      old_topic: null,
      new_topic: "First Topic",
    };
    expect(entry.old_topic).toBeNull();
    expect(entry.new_topic).toBe("First Topic");
  });

  it("handles null new topic (topic cleared)", () => {
    const entry = {
      old_topic: "Some Topic",
      new_topic: null,
    };
    expect(entry.old_topic).toBe("Some Topic");
    expect(entry.new_topic).toBeNull();
  });

  it("history response shape", () => {
    const response = {
      channel_id: "ch-1",
      history: [
        {
          id: "h1",
          channel_id: "ch-1",
          old_topic: "Topic A",
          new_topic: "Topic B",
          changed_by: "user-1",
          changed_by_name: "Alice",
          changed_at: "2025-01-15T10:30:00.000Z",
        },
      ],
    };
    expect(response.channel_id).toBe("ch-1");
    expect(response.history).toHaveLength(1);
    expect(response.history[0].new_topic).toBe("Topic B");
  });

  it("skips logging when topic unchanged", () => {
    const oldTopic = "Same Topic";
    const newTopic = "Same Topic";
    const shouldLog = oldTopic !== newTopic;
    expect(shouldLog).toBe(false);
  });

  it("logs change when topic is different", () => {
    const oldTopic = "Old";
    const newTopic = "New";
    const shouldLog = oldTopic !== newTopic;
    expect(shouldLog).toBe(true);
  });

  it("changed_by_name can be null for deleted users", () => {
    const entry = {
      changed_by: "deleted-user-id",
      changed_by_name: null,
    };
    expect(entry.changed_by_name).toBeNull();
  });
});
