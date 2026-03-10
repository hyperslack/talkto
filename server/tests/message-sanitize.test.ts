import { describe, it, expect } from "bun:test";
import { sanitizeContent, isValidContent, MAX_MESSAGE_LENGTH } from "../src/utils/message-sanitize";

describe("sanitizeContent", () => {
  it("trims whitespace", () => {
    expect(sanitizeContent("  hello  ")).toBe("hello");
  });

  it("collapses excessive newlines", () => {
    expect(sanitizeContent("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("removes null bytes", () => {
    expect(sanitizeContent("hello\x00world")).toBe("helloworld");
  });

  it("removes control characters but keeps newlines and tabs", () => {
    expect(sanitizeContent("a\tb\nc")).toBe("a\tb\nc");
    expect(sanitizeContent("a\x01b\x02c")).toBe("abc");
  });

  it("enforces max length", () => {
    const long = "a".repeat(MAX_MESSAGE_LENGTH + 100);
    expect(sanitizeContent(long).length).toBe(MAX_MESSAGE_LENGTH);
  });

  it("preserves normal content", () => {
    const content = "Hello @world! 🎉\nThis is a **test**.";
    expect(sanitizeContent(content)).toBe(content);
  });

  it("handles empty string", () => {
    expect(sanitizeContent("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(sanitizeContent("   \n\n   ")).toBe("");
  });
});

describe("isValidContent", () => {
  it("returns true for non-empty content", () => {
    expect(isValidContent("hello")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidContent("")).toBe(false);
  });

  it("returns false for whitespace-only", () => {
    expect(isValidContent("   \n  ")).toBe(false);
  });
});
