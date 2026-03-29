/**
 * Tests for message truncation utilities.
 */
import { describe, expect, it } from "vitest";
import {
  isLongMessage,
  truncateMessage,
  messagePreview,
  DEFAULT_MAX_LENGTH,
  DEFAULT_MAX_LINES,
} from "./message-truncation";

describe("isLongMessage", () => {
  it("returns false for short messages", () => {
    expect(isLongMessage("Hello world")).toBe(false);
  });

  it("returns true when exceeding max character length", () => {
    const long = "a".repeat(DEFAULT_MAX_LENGTH + 1);
    expect(isLongMessage(long)).toBe(true);
  });

  it("returns true when exceeding max line count", () => {
    const lines = Array(DEFAULT_MAX_LINES + 1).fill("line").join("\n");
    expect(isLongMessage(lines)).toBe(true);
  });

  it("respects custom maxLength option", () => {
    expect(isLongMessage("hello", { maxLength: 3 })).toBe(true);
    expect(isLongMessage("hi", { maxLength: 3 })).toBe(false);
  });

  it("respects custom maxLines option", () => {
    expect(isLongMessage("a\nb\nc", { maxLines: 2 })).toBe(true);
    expect(isLongMessage("a\nb", { maxLines: 2 })).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isLongMessage("")).toBe(false);
  });
});

describe("truncateMessage", () => {
  it("returns original content when not long", () => {
    const result = truncateMessage("Short message");
    expect(result).toEqual({ text: "Short message", wasTruncated: false });
  });

  it("truncates long messages by character count", () => {
    const long = "word ".repeat(200);
    const result = truncateMessage(long, { maxLength: 50 });
    expect(result.wasTruncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(55); // 50 + ellipsis margin
    expect(result.text).toMatch(/…$/);
  });

  it("truncates by line count", () => {
    const lines = Array(20).fill("short line").join("\n");
    const result = truncateMessage(lines, { maxLines: 3, maxLength: 10000 });
    expect(result.wasTruncated).toBe(true);
    expect(result.text.split("\n").length).toBeLessThanOrEqual(4); // 3 lines + ellipsis
  });

  it("uses custom ellipsis", () => {
    const long = "a".repeat(600);
    const result = truncateMessage(long, { maxLength: 50, ellipsis: "..." });
    expect(result.text).toMatch(/\.\.\.$/);
  });

  it("does not truncate at exact boundary", () => {
    const exact = "a".repeat(DEFAULT_MAX_LENGTH);
    const result = truncateMessage(exact);
    expect(result.wasTruncated).toBe(false);
  });
});

describe("messagePreview", () => {
  it("returns short messages as-is", () => {
    expect(messagePreview("Hello")).toBe("Hello");
  });

  it("strips newlines", () => {
    expect(messagePreview("line1\nline2\nline3")).toBe("line1 line2 line3");
  });

  it("truncates long messages with ellipsis", () => {
    const long = "word ".repeat(100);
    const result = messagePreview(long, 50);
    expect(result.length).toBeLessThanOrEqual(55);
    expect(result).toMatch(/…$/);
  });

  it("handles empty string", () => {
    expect(messagePreview("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(messagePreview("  hello  ")).toBe("hello");
  });
});
