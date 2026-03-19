import { describe, it, expect } from "bun:test";
import {
  classifyActivity,
  getActivityLevel,
  sortByActivity,
  activityEmoji,
  formatActivity,
} from "../src/utils/channel-activity-status";

const now = new Date("2026-01-15T12:00:00Z");

function minutesAgo(n: number): string {
  return new Date(now.getTime() - n * 60_000).toISOString();
}

describe("classifyActivity", () => {
  it("returns active for messages < 5 min ago", () => {
    const status = classifyActivity(minutesAgo(2), now);
    expect(status.level).toBe("active");
    expect(status.color).toBe("green");
    expect(status.minutesSinceLastMessage).toBe(2);
  });

  it("returns moderate for 5-60 min", () => {
    const status = classifyActivity(minutesAgo(30), now);
    expect(status.level).toBe("moderate");
    expect(status.color).toBe("yellow");
  });

  it("returns quiet for same-day (1-24h)", () => {
    const status = classifyActivity(minutesAgo(180), now);
    expect(status.level).toBe("quiet");
    expect(status.color).toBe("orange");
  });

  it("returns inactive for 1-7 days", () => {
    const status = classifyActivity(minutesAgo(3 * 1440), now);
    expect(status.level).toBe("inactive");
    expect(status.color).toBe("red");
  });

  it("returns dead for > 7 days", () => {
    const status = classifyActivity(minutesAgo(15 * 1440), now);
    expect(status.level).toBe("dead");
    expect(status.minutesSinceLastMessage).toBe(15 * 1440);
  });

  it("returns dead for null lastMessageAt", () => {
    const status = classifyActivity(null, now);
    expect(status.level).toBe("dead");
    expect(status.minutesSinceLastMessage).toBeNull();
  });

  it("returns dead for invalid date string", () => {
    const status = classifyActivity("not-a-date", now);
    expect(status.level).toBe("dead");
  });
});

describe("getActivityLevel", () => {
  it("returns just the level string", () => {
    expect(getActivityLevel(null)).toBe("dead");
  });
});

describe("sortByActivity", () => {
  it("sorts most active first", () => {
    const realNow = new Date();
    const channels = [
      { id: "dead", lastMessageAt: null },
      { id: "active", lastMessageAt: new Date(realNow.getTime() - 60_000).toISOString() },
      { id: "quiet", lastMessageAt: new Date(realNow.getTime() - 300 * 60_000).toISOString() },
    ];
    const sorted = sortByActivity(channels);
    expect(sorted.map((c) => c.id)).toEqual(["active", "quiet", "dead"]);
  });
});

describe("activityEmoji", () => {
  it("returns green for active", () => {
    expect(activityEmoji("active")).toBe("🟢");
  });

  it("returns black for dead", () => {
    expect(activityEmoji("dead")).toBe("⚫");
  });
});

describe("formatActivity", () => {
  it("formats with emoji and label", () => {
    const result = formatActivity(null);
    expect(result).toContain("⚫");
    expect(result).toContain("No activity");
  });
});
