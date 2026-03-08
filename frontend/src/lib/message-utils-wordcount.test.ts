/**
 * Tests for word count and reading time utilities.
 */

import { describe, expect, it } from "bun:test";
import { countWords, estimateReadingTime, formatTextStats } from "./message-utils";

describe("countWords", () => {
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });

  it("counts multiple words", () => {
    expect(countWords("hello world foo bar")).toBe(4);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("handles newlines and tabs", () => {
    expect(countWords("hello\nworld\tfoo")).toBe(3);
  });
});

describe("estimateReadingTime", () => {
  it("returns 1 minute minimum", () => {
    expect(estimateReadingTime("short")).toBe(1);
  });

  it("estimates longer text correctly", () => {
    const words = Array(400).fill("word").join(" ");
    expect(estimateReadingTime(words)).toBe(2);
  });
});

describe("formatTextStats", () => {
  it("formats single word correctly", () => {
    expect(formatTextStats("hello")).toBe("1 word · 5 chars");
  });

  it("formats multiple words correctly", () => {
    expect(formatTextStats("hello world")).toBe("2 words · 11 chars");
  });

  it("handles empty string", () => {
    expect(formatTextStats("")).toBe("0 words · 0 chars");
  });
});
