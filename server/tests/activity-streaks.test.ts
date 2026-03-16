import { describe, test, expect } from "bun:test";
import {
  computeStreak,
  formatStreak,
  getStreakMilestone,
  isStreakAtRisk,
} from "../src/lib/activity-streaks";

describe("computeStreak", () => {
  const today = "2026-03-16";

  test("returns zero streak for no activity", () => {
    const result = computeStreak("u1", [], today);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalActiveDays).toBe(0);
  });

  test("computes single-day streak", () => {
    const result = computeStreak("u1", ["2026-03-16T10:00:00Z"], today);
    expect(result.currentStreak).toBe(1);
    expect(result.isActiveToday).toBe(true);
  });

  test("computes multi-day consecutive streak", () => {
    const timestamps = [
      "2026-03-14T10:00:00Z",
      "2026-03-15T10:00:00Z",
      "2026-03-16T10:00:00Z",
    ];
    const result = computeStreak("u1", timestamps, today);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  test("breaks streak on gap", () => {
    const timestamps = [
      "2026-03-10T10:00:00Z",
      "2026-03-11T10:00:00Z",
      // gap on 12th
      "2026-03-15T10:00:00Z",
      "2026-03-16T10:00:00Z",
    ];
    const result = computeStreak("u1", timestamps, today);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  test("counts unique active days", () => {
    const timestamps = [
      "2026-03-16T08:00:00Z",
      "2026-03-16T09:00:00Z",
      "2026-03-16T10:00:00Z",
    ];
    const result = computeStreak("u1", timestamps, today);
    expect(result.totalActiveDays).toBe(1);
  });

  test("streak is 0 when last activity was more than 1 day ago", () => {
    const timestamps = ["2026-03-13T10:00:00Z"];
    const result = computeStreak("u1", timestamps, today);
    expect(result.currentStreak).toBe(0);
  });

  test("streak extends from yesterday", () => {
    const timestamps = [
      "2026-03-14T10:00:00Z",
      "2026-03-15T10:00:00Z",
    ];
    const result = computeStreak("u1", timestamps, today);
    expect(result.currentStreak).toBe(2);
    expect(result.isActiveToday).toBe(false);
  });
});

describe("formatStreak", () => {
  test("shows no streak message", () => {
    const info = { userId: "u1", currentStreak: 0, longestStreak: 5, totalActiveDays: 10, lastActiveDate: null, isActiveToday: false };
    expect(formatStreak(info)).toBe("No active streak");
  });

  test("shows fire emoji for 7+ days", () => {
    const info = { userId: "u1", currentStreak: 10, longestStreak: 10, totalActiveDays: 10, lastActiveDate: "2026-03-16", isActiveToday: true };
    expect(formatStreak(info)).toContain("🔥");
  });

  test("shows lightning for 3-6 days", () => {
    const info = { userId: "u1", currentStreak: 5, longestStreak: 5, totalActiveDays: 5, lastActiveDate: "2026-03-16", isActiveToday: true };
    expect(formatStreak(info)).toContain("⚡");
  });
});

describe("getStreakMilestone", () => {
  test("returns milestone for notable days", () => {
    expect(getStreakMilestone(7)).toContain("week");
    expect(getStreakMilestone(30)).toContain("month");
    expect(getStreakMilestone(100)).toContain("100");
    expect(getStreakMilestone(365)).toContain("year");
  });

  test("returns null for non-milestone days", () => {
    expect(getStreakMilestone(3)).toBeNull();
    expect(getStreakMilestone(50)).toBeNull();
  });
});

describe("isStreakAtRisk", () => {
  test("returns true when active yesterday but not today", () => {
    const info = { userId: "u1", currentStreak: 5, longestStreak: 5, totalActiveDays: 5, lastActiveDate: "2026-03-15", isActiveToday: false };
    expect(isStreakAtRisk(info, "2026-03-16")).toBe(true);
  });

  test("returns false when active today", () => {
    const info = { userId: "u1", currentStreak: 5, longestStreak: 5, totalActiveDays: 5, lastActiveDate: "2026-03-16", isActiveToday: true };
    expect(isStreakAtRisk(info, "2026-03-16")).toBe(false);
  });

  test("returns false when streak already broken", () => {
    const info = { userId: "u1", currentStreak: 0, longestStreak: 5, totalActiveDays: 5, lastActiveDate: "2026-03-10", isActiveToday: false };
    expect(isStreakAtRisk(info, "2026-03-16")).toBe(false);
  });
});
