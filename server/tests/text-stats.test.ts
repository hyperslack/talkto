/**
 * Tests for text statistics utilities.
 */

import { describe, expect, it } from "bun:test";
import { computeTextStats, extractEmoji, countEmojiUsage } from "../src/utils/text-stats";

describe("computeTextStats", () => {
  it("computes basic stats", () => {
    const stats = computeTextStats(["hello world", "foo bar baz"]);
    expect(stats.total_messages).toBe(2);
    expect(stats.total_words).toBe(5);
    expect(stats.avg_words_per_message).toBe(2.5);
  });

  it("handles empty input", () => {
    const stats = computeTextStats([]);
    expect(stats.total_messages).toBe(0);
    expect(stats.total_words).toBe(0);
    expect(stats.unique_words).toBe(0);
  });

  it("counts unique words", () => {
    const stats = computeTextStats(["hello hello world"]);
    expect(stats.unique_words).toBe(2);
  });

  it("returns top words sorted by frequency", () => {
    const stats = computeTextStats([
      "the quick brown fox",
      "the quick red fox",
      "the slow brown dog",
    ], 3);
    expect(stats.top_words[0].word).toBe("the");
    expect(stats.top_words[0].count).toBe(3);
  });

  it("filters short words from top words", () => {
    const stats = computeTextStats(["a b c d hello hello"]);
    // "a", "b", "c", "d" should be filtered (length <= 2)
    expect(stats.top_words.some(w => w.word === "hello")).toBe(true);
    expect(stats.top_words.some(w => w.word === "a")).toBe(false);
  });
});

describe("extractEmoji", () => {
  it("extracts emoji from text", () => {
    const emoji = extractEmoji("Hello 🎉 World 🔥");
    expect(emoji).toContain("🎉");
    expect(emoji).toContain("🔥");
  });

  it("returns empty for no emoji", () => {
    expect(extractEmoji("no emoji here")).toHaveLength(0);
  });
});

describe("countEmojiUsage", () => {
  it("counts emoji frequency", () => {
    const counts = countEmojiUsage(["🎉🎉", "🎉🔥"]);
    expect(counts.get("🎉")).toBe(3);
    expect(counts.get("🔥")).toBe(1);
  });
});
