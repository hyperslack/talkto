import { describe, it, expect } from "bun:test";
import {
  groupMessages,
  countGroups,
  getGroupStarts,
  splitIntoGroups,
} from "../src/utils/message-grouping";

function msg(id: string, sender: string, minutesAgo: number, parentId?: string) {
  const d = new Date("2026-01-01T12:00:00Z");
  d.setMinutes(d.getMinutes() - minutesAgo);
  return {
    id,
    sender_id: sender,
    created_at: d.toISOString(),
    parent_id: parentId ?? null,
  };
}

describe("groupMessages", () => {
  it("returns empty for empty input", () => {
    expect(groupMessages([])).toEqual([]);
  });

  it("marks a single message as solo", () => {
    const result = groupMessages([msg("1", "alice", 0)]);
    expect(result).toHaveLength(1);
    expect(result[0].isGroupStart).toBe(true);
    expect(result[0].isContinuation).toBe(false);
    expect(result[0].position).toBe("solo");
    expect(result[0].groupIndex).toBe(0);
  });

  it("groups consecutive messages from same sender within window", () => {
    const messages = [
      msg("1", "alice", 4),
      msg("2", "alice", 3),
      msg("3", "alice", 2),
    ];
    const result = groupMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].position).toBe("first");
    expect(result[1].position).toBe("middle");
    expect(result[2].position).toBe("last");
    expect(result.every((r) => r.groupIndex === 0)).toBe(true);
  });

  it("splits groups on sender change", () => {
    const messages = [
      msg("1", "alice", 4),
      msg("2", "alice", 3),
      msg("3", "bob", 2),
      msg("4", "bob", 1),
    ];
    const result = groupMessages(messages);
    expect(result[0].groupIndex).toBe(0);
    expect(result[1].groupIndex).toBe(0);
    expect(result[2].groupIndex).toBe(1);
    expect(result[3].groupIndex).toBe(1);
    expect(result[2].isGroupStart).toBe(true);
  });

  it("splits groups when time gap exceeds window", () => {
    const messages = [
      msg("1", "alice", 10),
      msg("2", "alice", 3), // 7 min gap > 5 min default window
    ];
    const result = groupMessages(messages);
    expect(result[0].position).toBe("solo");
    expect(result[1].position).toBe("solo");
    expect(result[0].groupIndex).toBe(0);
    expect(result[1].groupIndex).toBe(1);
  });

  it("respects custom window size", () => {
    const messages = [
      msg("1", "alice", 10),
      msg("2", "alice", 3), // 7 min gap
    ];
    // With 10-minute window, they should group
    const result = groupMessages(messages, 10 * 60 * 1000);
    expect(result[0].groupIndex).toBe(0);
    expect(result[1].groupIndex).toBe(0);
  });

  it("breaks group on different parent_id", () => {
    const messages = [
      msg("1", "alice", 4, null),
      msg("2", "alice", 3, "thread-1"),
    ];
    const result = groupMessages(messages);
    expect(result[0].groupIndex).toBe(0);
    expect(result[1].groupIndex).toBe(1);
  });

  it("handles alternating senders correctly", () => {
    const messages = [
      msg("1", "alice", 5),
      msg("2", "bob", 4),
      msg("3", "alice", 3),
      msg("4", "bob", 2),
    ];
    const result = groupMessages(messages);
    expect(result.map((r) => r.groupIndex)).toEqual([0, 1, 2, 3]);
    expect(result.every((r) => r.position === "solo")).toBe(true);
  });
});

describe("countGroups", () => {
  it("returns 0 for empty", () => {
    expect(countGroups([])).toBe(0);
  });

  it("counts groups correctly", () => {
    const messages = [
      msg("1", "alice", 4),
      msg("2", "alice", 3),
      msg("3", "bob", 2),
    ];
    expect(countGroups(messages)).toBe(2);
  });
});

describe("getGroupStarts", () => {
  it("returns first message of each group", () => {
    const messages = [
      msg("1", "alice", 4),
      msg("2", "alice", 3),
      msg("3", "bob", 2),
    ];
    const starts = getGroupStarts(messages);
    expect(starts.map((m) => m.id)).toEqual(["1", "3"]);
  });
});

describe("splitIntoGroups", () => {
  it("returns empty for empty input", () => {
    expect(splitIntoGroups([])).toEqual([]);
  });

  it("splits into correct arrays", () => {
    const messages = [
      msg("1", "alice", 4),
      msg("2", "alice", 3),
      msg("3", "bob", 2),
      msg("4", "bob", 1),
    ];
    const groups = splitIntoGroups(messages);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((m) => m.id)).toEqual(["1", "2"]);
    expect(groups[1].map((m) => m.id)).toEqual(["3", "4"]);
  });
});
