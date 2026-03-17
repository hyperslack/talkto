import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  computeTrend,
  formatTrend,
  splitIntoWeeks,
  topActiveDays,
  dailyGrowthRates,
  type DailyMetric,
} from "../src/utils/workspace-analytics";

const days: DailyMetric[] = [
  { date: "2025-01-01", messageCount: 50, activeUsers: 10, activeChannels: 5 },
  { date: "2025-01-02", messageCount: 80, activeUsers: 15, activeChannels: 6 },
  { date: "2025-01-03", messageCount: 30, activeUsers: 8, activeChannels: 4 },
  { date: "2025-01-04", messageCount: 100, activeUsers: 20, activeChannels: 7 },
];

describe("computeMetrics", () => {
  it("computes aggregate metrics", () => {
    const m = computeMetrics(days);
    expect(m.totalMessages).toBe(260);
    expect(m.avgMessagesPerDay).toBe(65);
    expect(m.peakDay?.date).toBe("2025-01-04");
    expect(m.quietestDay?.date).toBe("2025-01-03");
    expect(m.totalActiveUsers).toBe(20);
    expect(m.totalActiveChannels).toBe(7);
  });

  it("handles empty data", () => {
    const m = computeMetrics([]);
    expect(m.totalMessages).toBe(0);
    expect(m.peakDay).toBeNull();
  });
});

describe("computeTrend", () => {
  it("detects upward trend", () => {
    const t = computeTrend(150, 100);
    expect(t.direction).toBe("up");
    expect(t.change).toBe(50);
    expect(t.changePercent).toBe(50);
  });

  it("detects downward trend", () => {
    const t = computeTrend(80, 100);
    expect(t.direction).toBe("down");
    expect(t.change).toBe(-20);
  });

  it("detects flat trend", () => {
    const t = computeTrend(100, 100);
    expect(t.direction).toBe("flat");
  });

  it("handles zero previous", () => {
    expect(computeTrend(50, 0).changePercent).toBe(100);
    expect(computeTrend(0, 0).changePercent).toBe(0);
  });
});

describe("formatTrend", () => {
  it("formats upward trend", () => {
    const result = formatTrend(computeTrend(150, 100));
    expect(result).toContain("📈");
    expect(result).toContain("+50");
  });

  it("formats downward trend", () => {
    const result = formatTrend(computeTrend(80, 100));
    expect(result).toContain("📉");
  });
});

describe("splitIntoWeeks", () => {
  it("splits data into week chunks", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      messageCount: i * 10,
      activeUsers: i,
      activeChannels: i,
    }));
    const weeks = splitIntoWeeks(data);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]).toHaveLength(3);
  });
});

describe("topActiveDays", () => {
  it("returns top N days", () => {
    const top = topActiveDays(days, 2);
    expect(top).toHaveLength(2);
    expect(top[0].date).toBe("2025-01-04");
    expect(top[1].date).toBe("2025-01-02");
  });
});

describe("dailyGrowthRates", () => {
  it("computes day-over-day rates", () => {
    const rates = dailyGrowthRates(days);
    expect(rates).toHaveLength(3);
    expect(rates[0].date).toBe("2025-01-02");
    expect(rates[0].rate).toBe(60); // 50→80 = +60%
  });
});
