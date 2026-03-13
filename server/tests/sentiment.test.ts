import { describe, it, expect } from "bun:test";
import { analyzeSentiment, computeChannelMood, moodEmoji } from "../src/lib/sentiment";

describe("analyzeSentiment", () => {
  it("detects positive sentiment", () => {
    const result = analyzeSentiment("This is great and awesome work!");
    expect(result.sentiment).toBe("positive");
    expect(result.score).toBeGreaterThan(0);
    expect(result.positiveWords.length).toBeGreaterThan(0);
  });

  it("detects negative sentiment", () => {
    const result = analyzeSentiment("This is terrible and broken");
    expect(result.sentiment).toBe("negative");
    expect(result.score).toBeLessThan(0);
    expect(result.negativeWords.length).toBeGreaterThan(0);
  });

  it("returns neutral for ambiguous text", () => {
    const result = analyzeSentiment("the cat sat on the mat");
    expect(result.sentiment).toBe("neutral");
    expect(result.score).toBe(0);
  });

  it("returns neutral for empty text", () => {
    const result = analyzeSentiment("");
    expect(result.sentiment).toBe("neutral");
    expect(result.score).toBe(0);
  });

  it("handles negation (not good → negative)", () => {
    const result = analyzeSentiment("this is not good");
    expect(result.negativeWords).toContain("good");
  });

  it("handles negation (not bad → positive)", () => {
    const result = analyzeSentiment("this is not bad at all");
    expect(result.positiveWords).toContain("bad");
  });

  it("handles mixed sentiment", () => {
    const result = analyzeSentiment("good design but terrible performance");
    expect(result.positiveWords.length).toBeGreaterThan(0);
    expect(result.negativeWords.length).toBeGreaterThan(0);
  });
});

describe("computeChannelMood", () => {
  it("computes positive mood", () => {
    const results = [
      analyzeSentiment("great job!"),
      analyzeSentiment("awesome work!"),
      analyzeSentiment("love it"),
    ];
    const mood = computeChannelMood(results);
    expect(mood.sentiment).toBe("positive");
    expect(mood.positiveCount).toBe(3);
    expect(mood.messageCount).toBe(3);
  });

  it("returns neutral for empty results", () => {
    const mood = computeChannelMood([]);
    expect(mood.sentiment).toBe("neutral");
    expect(mood.messageCount).toBe(0);
  });

  it("counts sentiment categories", () => {
    const results = [
      analyzeSentiment("great"),
      analyzeSentiment("terrible"),
      analyzeSentiment("the cat"),
    ];
    const mood = computeChannelMood(results);
    expect(mood.positiveCount).toBe(1);
    expect(mood.negativeCount).toBe(1);
    expect(mood.neutralCount).toBe(1);
  });
});

describe("moodEmoji", () => {
  it("returns correct emojis", () => {
    expect(moodEmoji("positive")).toBe("😊");
    expect(moodEmoji("negative")).toBe("😟");
    expect(moodEmoji("neutral")).toBe("😐");
  });
});
