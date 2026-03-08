/**
 * Tests for character limit validation utilities.
 */

import { describe, expect, it } from "bun:test";
import {
  getCharLimitFeedback,
  isWithinLimit,
  truncateToLimit,
  MAX_MESSAGE_LENGTH,
} from "../src/utils/char-limit";

describe("Character Limit Validation", () => {
  it("MAX_MESSAGE_LENGTH is 4000", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(4000);
  });

  it("short message has no feedback", () => {
    const result = getCharLimitFeedback("hello");
    expect(result.length).toBe(5);
    expect(result.remaining).toBe(3995);
    expect(result.over_limit).toBe(false);
    expect(result.feedback).toBe("");
  });

  it("message near limit shows remaining count", () => {
    const text = "a".repeat(3950);
    const result = getCharLimitFeedback(text);
    expect(result.remaining).toBe(50);
    expect(result.feedback).toBe("50 characters remaining");
    expect(result.over_limit).toBe(false);
  });

  it("message over limit shows excess count", () => {
    const text = "a".repeat(4010);
    const result = getCharLimitFeedback(text);
    expect(result.remaining).toBe(-10);
    expect(result.over_limit).toBe(true);
    expect(result.feedback).toBe("10 characters over limit");
  });

  it("isWithinLimit returns true for short text", () => {
    expect(isWithinLimit("hello")).toBe(true);
  });

  it("isWithinLimit returns false for long text", () => {
    expect(isWithinLimit("a".repeat(4001))).toBe(false);
  });

  it("isWithinLimit works with custom max", () => {
    expect(isWithinLimit("hello", 3)).toBe(false);
    expect(isWithinLimit("hi", 3)).toBe(true);
  });

  it("truncateToLimit returns original if within limit", () => {
    expect(truncateToLimit("hello")).toBe("hello");
  });

  it("truncateToLimit truncates and adds ellipsis", () => {
    const result = truncateToLimit("a".repeat(100), 20);
    expect(result.length).toBe(20);
    expect(result.endsWith("...")).toBe(true);
  });

  it("empty string is within limit", () => {
    const result = getCharLimitFeedback("");
    expect(result.length).toBe(0);
    expect(result.remaining).toBe(4000);
    expect(result.over_limit).toBe(false);
  });
});
