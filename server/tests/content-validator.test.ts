import { describe, test, expect } from "bun:test";
import {
  validateContent,
  normalizeContent,
  extractMentions,
  isLikelySpam,
  createBannedPatternRule,
  createMinLengthRule,
  MAX_MESSAGE_LENGTH,
} from "../src/lib/content-validator";

describe("validateContent", () => {
  test("accepts valid content", () => {
    const result = validateContent("Hello world");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects empty content", () => {
    const result = validateContent("");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("empty");
  });

  test("rejects whitespace-only content", () => {
    const result = validateContent("   \n\n  ");
    expect(result.valid).toBe(false);
  });

  test("rejects content exceeding max length", () => {
    const long = "a".repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateContent(long);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("maximum length");
  });

  test("warns on excessive repeated characters", () => {
    const spam = "a".repeat(60);
    const result = validateContent(spam);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  test("warns on formatting-only content", () => {
    const result = validateContent("**  ** ~~  ~~");
    expect(result.warnings.some((w) => w.includes("formatting"))).toBe(true);
  });

  test("applies custom validation rules", () => {
    const noLinks = createBannedPatternRule("no-links", /https?:\/\//, "Links not allowed");
    const result = validateContent("Check https://evil.com", [noLinks]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Links not allowed");
  });
});

describe("normalizeContent", () => {
  test("trims whitespace", () => {
    expect(normalizeContent("  hello  ")).toBe("hello");
  });

  test("collapses excessive newlines", () => {
    const result = normalizeContent("a\n\n\n\n\n\n\n\n\nb");
    const newlines = (result.match(/\n/g) || []).length;
    expect(newlines).toBeLessThanOrEqual(5);
  });

  test("removes control characters", () => {
    const result = normalizeContent("hello\x00world\x07test");
    expect(result).toBe("helloworldtest");
  });

  test("preserves tabs and newlines", () => {
    const result = normalizeContent("hello\tworld\ntest");
    expect(result).toContain("\t");
    expect(result).toContain("\n");
  });
});

describe("extractMentions", () => {
  test("extracts @mentions", () => {
    const mentions = extractMentions("Hey @alice and @bob-2, check this");
    expect(mentions).toContain("alice");
    expect(mentions).toContain("bob-2");
  });

  test("returns empty for no mentions", () => {
    expect(extractMentions("No mentions here")).toEqual([]);
  });

  test("deduplicates mentions", () => {
    const mentions = extractMentions("@alice said @alice should");
    expect(mentions).toHaveLength(1);
  });
});

describe("isLikelySpam", () => {
  test("detects all-caps spam", () => {
    expect(isLikelySpam("THIS IS ALL CAPS SPAM MESSAGE VERY LOUD")).toBe(true);
  });

  test("allows short all-caps", () => {
    expect(isLikelySpam("OK")).toBe(false);
  });

  test("detects excessive repeats", () => {
    expect(isLikelySpam("a".repeat(60))).toBe(true);
  });

  test("detects word repetition spam", () => {
    expect(isLikelySpam(("buy " ).repeat(15))).toBe(true);
  });

  test("allows normal messages", () => {
    expect(isLikelySpam("This is a normal message with varied content.")).toBe(false);
  });
});

describe("createMinLengthRule", () => {
  test("rejects short messages", () => {
    const rule = createMinLengthRule(5);
    expect(rule.check("hi")).toContain("at least 5");
  });

  test("accepts long enough messages", () => {
    const rule = createMinLengthRule(3);
    expect(rule.check("hello")).toBeNull();
  });
});
