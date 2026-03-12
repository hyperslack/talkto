/**
 * Tests for channel engagement scoring.
 */

import { describe, expect, it } from "bun:test";
import {
  computeEngagement,
  scoreToLevel,
  formatEngagement,
  levelEmoji,
  compareEngagement,
} from "../src/services/channel-engagement";

describe("computeEngagement", () => {
  it("computes score for active channel", () => {
    const result = computeEngagement({
      messageCount: 300,
      uniqueSenders: 8,
      reactionCount: 50,
      threadCount: 20,
      memberCount: 10,
      daysSinceCreation: 30,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.activity).toBeGreaterThan(0);
    expect(result.breakdown.diversity).toBeGreaterThan(0);
  });

  it("returns 0 for empty channel", () => {
    const result = computeEngagement({
      messageCount: 0,
      uniqueSenders: 0,
      reactionCount: 0,
      threadCount: 0,
      memberCount: 5,
      daysSinceCreation: 30,
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe("dead");
  });

  it("caps score at 100", () => {
    const result = computeEngagement({
      messageCount: 10000,
      uniqueSenders: 100,
      reactionCount: 5000,
      threadCount: 5000,
      memberCount: 100,
      daysSinceCreation: 1,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles zero members gracefully", () => {
    const result = computeEngagement({
      messageCount: 10,
      uniqueSenders: 2,
      reactionCount: 1,
      threadCount: 1,
      memberCount: 0,
      daysSinceCreation: 5,
    });
    expect(result.breakdown.diversity).toBe(0);
  });
});

describe("scoreToLevel", () => {
  it("maps scores to correct levels", () => {
    expect(scoreToLevel(0)).toBe("dead");
    expect(scoreToLevel(10)).toBe("dead");
    expect(scoreToLevel(20)).toBe("low");
    expect(scoreToLevel(50)).toBe("moderate");
    expect(scoreToLevel(75)).toBe("active");
    expect(scoreToLevel(90)).toBe("thriving");
  });
});

describe("formatEngagement", () => {
  it("formats score with emoji", () => {
    const score = computeEngagement({
      messageCount: 100,
      uniqueSenders: 5,
      reactionCount: 10,
      threadCount: 5,
      memberCount: 10,
      daysSinceCreation: 10,
    });
    const text = formatEngagement(score);
    expect(text).toContain("/100");
    expect(text.length).toBeGreaterThan(5);
  });
});

describe("levelEmoji", () => {
  it("returns emoji for each level", () => {
    expect(levelEmoji("dead")).toBe("💀");
    expect(levelEmoji("thriving")).toBe("🚀");
  });
});

describe("compareEngagement", () => {
  it("compares two scores", () => {
    const a = computeEngagement({ messageCount: 100, uniqueSenders: 5, reactionCount: 10, threadCount: 5, memberCount: 10, daysSinceCreation: 10 });
    const b = computeEngagement({ messageCount: 10, uniqueSenders: 1, reactionCount: 0, threadCount: 0, memberCount: 10, daysSinceCreation: 10 });
    expect(compareEngagement(a, b)).toBeGreaterThan(0);
  });
});
