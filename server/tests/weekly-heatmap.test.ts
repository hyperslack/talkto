import { describe, it, expect } from "bun:test";
import { buildHeatmap, busiestDay, quietestDay, intensityLevel } from "../src/lib/weekly-heatmap";

describe("buildHeatmap", () => {
  it("returns a 168-cell grid (7 days × 24 hours)", () => {
    const result = buildHeatmap([]);
    expect(result.grid.length).toBe(168);
    expect(result.totalMessages).toBe(0);
  });

  it("counts messages into correct day/hour cells", () => {
    // Wednesday 2025-01-15 at 14:30 UTC → day=3, hour=14
    const ts = "2025-01-15T14:30:00.000Z";
    const result = buildHeatmap([ts, ts, ts]);
    const cell = result.grid.find((c) => c.day === 3 && c.hour === 14);
    expect(cell?.count).toBe(3);
    expect(result.totalMessages).toBe(3);
  });

  it("identifies peak day and hour", () => {
    const ts = "2025-01-15T14:30:00.000Z"; // Wed 14:00
    const result = buildHeatmap([ts, ts]);
    expect(result.peakDay).toBe(3);
    expect(result.peakHour).toBe(14);
    expect(result.peakCount).toBe(2);
  });

  it("ignores invalid timestamps", () => {
    const result = buildHeatmap(["not-a-date", "also-bad"]);
    expect(result.totalMessages).toBe(0);
  });

  it("handles mixed valid and invalid timestamps", () => {
    const result = buildHeatmap(["2025-01-15T10:00:00Z", "invalid"]);
    expect(result.totalMessages).toBe(1);
  });
});

describe("busiestDay", () => {
  it("returns the day with most messages", () => {
    // 5 messages on Wednesday
    const ts = "2025-01-15T10:00:00.000Z";
    const heatmap = buildHeatmap([ts, ts, ts, ts, ts]);
    const busiest = busiestDay(heatmap);
    expect(busiest.day).toBe(3);
    expect(busiest.dayName).toBe("Wednesday");
    expect(busiest.count).toBe(5);
  });
});

describe("quietestDay", () => {
  it("returns the day with fewest messages", () => {
    // All messages on Wednesday, other days have 0
    const ts = "2025-01-15T10:00:00.000Z";
    const heatmap = buildHeatmap([ts]);
    const quietest = quietestDay(heatmap);
    expect(quietest.count).toBe(0);
    expect(quietest.day).not.toBe(3);
  });
});

describe("intensityLevel", () => {
  it("returns 0 for zero count", () => {
    expect(intensityLevel(0, 100)).toBe(0);
  });

  it("returns 0 when max is 0", () => {
    expect(intensityLevel(5, 0)).toBe(0);
  });

  it("returns 1 for low ratios", () => {
    expect(intensityLevel(10, 100)).toBe(1);
  });

  it("returns 4 for high ratios", () => {
    expect(intensityLevel(100, 100)).toBe(4);
  });

  it("returns 2 for medium ratios", () => {
    expect(intensityLevel(40, 100)).toBe(2);
  });
});
