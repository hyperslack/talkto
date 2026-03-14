import { describe, expect, test } from "bun:test";
import {
  classifyPresence,
  buildRoster,
  presenceIndicator,
  formatMemberList,
  recentlyActive,
  type ChannelMember,
} from "../src/utils/channel-online-roster";

const NOW = 1700000000000;

function member(name: string, lastSeenAt: number, type: "human" | "agent" = "human"): ChannelMember {
  return { userId: `u-${name}`, name, type, lastSeenAt };
}

describe("classifyPresence", () => {
  test("online within 5 minutes", () => {
    expect(classifyPresence(NOW - 60_000, NOW)).toBe("online");
  });

  test("away between 5 and 30 minutes", () => {
    expect(classifyPresence(NOW - 10 * 60_000, NOW)).toBe("away");
  });

  test("offline after 30 minutes", () => {
    expect(classifyPresence(NOW - 60 * 60_000, NOW)).toBe("offline");
  });

  test("custom thresholds", () => {
    expect(classifyPresence(NOW - 2000, NOW, { onlineMs: 1000 })).toBe("away");
  });

  test("exactly at boundary is online", () => {
    expect(classifyPresence(NOW - 5 * 60_000, NOW)).toBe("online");
  });
});

describe("buildRoster", () => {
  test("classifies members into groups", () => {
    const members = [
      member("alice", NOW - 60_000),      // online
      member("bob", NOW - 10 * 60_000),   // away
      member("charlie", NOW - 60 * 60_000), // offline
    ];
    const roster = buildRoster(members, NOW);
    expect(roster.online.length).toBe(1);
    expect(roster.away.length).toBe(1);
    expect(roster.offline.length).toBe(1);
    expect(roster.totalOnline).toBe(1);
    expect(roster.totalMembers).toBe(3);
  });

  test("sorts each group by name", () => {
    const members = [
      member("zara", NOW - 1000),
      member("alice", NOW - 2000),
    ];
    const roster = buildRoster(members, NOW);
    expect(roster.online[0].name).toBe("alice");
    expect(roster.online[1].name).toBe("zara");
  });

  test("handles empty member list", () => {
    const roster = buildRoster([], NOW);
    expect(roster.totalOnline).toBe(0);
    expect(roster.totalMembers).toBe(0);
  });
});

describe("presenceIndicator", () => {
  test("returns green circle for online", () => {
    expect(presenceIndicator("online")).toBe("🟢");
  });

  test("returns yellow circle for away", () => {
    expect(presenceIndicator("away")).toBe("🟡");
  });

  test("returns black circle for offline", () => {
    expect(presenceIndicator("offline")).toBe("⚫");
  });
});

describe("formatMemberList", () => {
  test("single member", () => {
    expect(formatMemberList(["Alice"])).toBe("Alice");
  });

  test("two members", () => {
    expect(formatMemberList(["Alice", "Bob"])).toBe("Alice and Bob");
  });

  test("three members", () => {
    expect(formatMemberList(["Alice", "Bob", "Charlie"])).toBe("Alice, Bob and Charlie");
  });

  test("more than maxShow", () => {
    expect(formatMemberList(["A", "B", "C", "D", "E"], 2)).toBe("A, B, and 3 others");
  });

  test("empty list", () => {
    expect(formatMemberList([])).toBe("No one");
  });

  test("single overflow", () => {
    expect(formatMemberList(["A", "B", "C", "D"], 3)).toBe("A, B, C, and 1 other");
  });
});

describe("recentlyActive", () => {
  test("returns members within window sorted by recency", () => {
    const members = [
      member("alice", NOW - 30 * 60_000),
      member("bob", NOW - 5 * 60_000),
      member("charlie", NOW - 2 * 60 * 60_000),
    ];
    const recent = recentlyActive(members, 60 * 60_000, NOW);
    expect(recent.length).toBe(2);
    expect(recent[0].name).toBe("bob"); // more recent first
    expect(recent[1].name).toBe("alice");
  });

  test("returns empty for no recent activity", () => {
    const members = [member("alice", NOW - 2 * 60 * 60_000)];
    expect(recentlyActive(members, 60 * 60_000, NOW)).toEqual([]);
  });
});
