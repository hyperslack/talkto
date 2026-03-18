import { describe, expect, test } from "bun:test";
import {
  sortByName,
  sortByActivity,
  sortByUnread,
  sortByMemberCount,
  sortByPosition,
  sortByCreatedAt,
  sortByMultiple,
  partitionArchived,
  groupByType,
  withUnreads,
  type SortableChannel,
} from "../src/utils/channel-sorting";

const channels: SortableChannel[] = [
  { id: "1", name: "general", type: "general", created_at: "2026-01-01", last_message_at: "2026-03-01", unread_count: 0, member_count: 10, position: 1 },
  { id: "2", name: "dev", type: "project", created_at: "2026-02-01", last_message_at: "2026-03-15", unread_count: 5, member_count: 3, position: 2 },
  { id: "3", name: "random", type: "custom", created_at: "2026-01-15", last_message_at: null, unread_count: 2, member_count: 8, position: null, is_archived: true },
  { id: "4", name: "alpha", type: "project", created_at: "2026-03-01", last_message_at: "2026-03-18", unread_count: 0, member_count: 5, position: null },
];

describe("Channel Sorting Utilities", () => {
  test("sortByName ascending", () => {
    const result = sortByName(channels, "asc");
    expect(result.map((c) => c.name)).toEqual(["alpha", "dev", "general", "random"]);
  });

  test("sortByName descending", () => {
    const result = sortByName(channels, "desc");
    expect(result.map((c) => c.name)).toEqual(["random", "general", "dev", "alpha"]);
  });

  test("sortByActivity places most recent first", () => {
    const result = sortByActivity(channels, "desc");
    expect(result[0].name).toBe("alpha");
    expect(result[result.length - 1].name).toBe("random"); // null activity sorts last
  });

  test("sortByActivity ascending", () => {
    const result = sortByActivity(channels, "asc");
    expect(result[0].name).toBe("general"); // oldest activity first
    expect(result[result.length - 1].name).toBe("random"); // null sorts last
  });

  test("sortByUnread descending", () => {
    const result = sortByUnread(channels, "desc");
    expect(result[0].name).toBe("dev"); // 5 unreads
    expect(result[1].name).toBe("random"); // 2 unreads
  });

  test("sortByMemberCount descending", () => {
    const result = sortByMemberCount(channels, "desc");
    expect(result[0].name).toBe("general"); // 10 members
  });

  test("sortByPosition sorts by position then name", () => {
    const result = sortByPosition(channels);
    expect(result[0].name).toBe("general"); // pos 1
    expect(result[1].name).toBe("dev"); // pos 2
    // null positions sorted by name after
    expect(result[2].name).toBe("alpha");
    expect(result[3].name).toBe("random");
  });

  test("sortByCreatedAt descending", () => {
    const result = sortByCreatedAt(channels, "desc");
    expect(result[0].name).toBe("alpha"); // newest
  });

  test("sortByMultiple applies criteria in priority order", () => {
    const result = sortByMultiple(channels, [
      { field: "unread_count", direction: "desc" },
      { field: "name", direction: "asc" },
    ]);
    expect(result[0].name).toBe("dev"); // highest unread
  });

  test("partitionArchived separates channels", () => {
    const { active, archived } = partitionArchived(channels);
    expect(active).toHaveLength(3);
    expect(archived).toHaveLength(1);
    expect(archived[0].name).toBe("random");
  });

  test("groupByType groups correctly", () => {
    const groups = groupByType(channels);
    expect(groups.get("project")).toHaveLength(2);
    expect(groups.get("general")).toHaveLength(1);
    expect(groups.get("custom")).toHaveLength(1);
  });

  test("withUnreads filters to channels with unreads", () => {
    const result = withUnreads(channels);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name).sort()).toEqual(["dev", "random"]);
  });

  test("does not mutate original array", () => {
    const original = [...channels];
    sortByName(channels);
    expect(channels).toEqual(original);
  });
});
