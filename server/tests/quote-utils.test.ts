import { describe, test, expect } from "bun:test";
import {
  formatQuote,
  buildQuotedReply,
  truncateQuote,
  hasQuote,
  extractReply,
  parseQuoteBlock,
  countQuotes,
  stripQuotes,
  MAX_QUOTE_LENGTH,
} from "../src/lib/quote-utils";

describe("quote-utils", () => {
  describe("formatQuote", () => {
    test("formats single-line quote with attribution", () => {
      const result = formatQuote("Alice", "Hello world");
      expect(result).toBe('> **Alice** wrote:\n> Hello world');
    });

    test("formats multi-line quote", () => {
      const result = formatQuote("Bob", "Line 1\nLine 2\nLine 3");
      expect(result).toBe('> **Bob** wrote:\n> Line 1\n> Line 2\n> Line 3');
    });

    test("truncates long content", () => {
      const longText = "a ".repeat(200).trim();
      const result = formatQuote("Alice", longText, 50);
      expect(result).toContain("…");
    });
  });

  describe("buildQuotedReply", () => {
    test("combines quote and reply", () => {
      const result = buildQuotedReply("Alice", "Original message", "My reply");
      expect(result).toContain("> **Alice** wrote:");
      expect(result).toContain("> Original message");
      expect(result).toContain("My reply");
    });

    test("separates quote and reply with blank line", () => {
      const result = buildQuotedReply("Bob", "Hi", "Hey back");
      expect(result).toContain("\n\nHey back");
    });
  });

  describe("truncateQuote", () => {
    test("does not truncate short content", () => {
      expect(truncateQuote("Short text")).toBe("Short text");
    });

    test("truncates at word boundary", () => {
      const text = "word ".repeat(100).trim();
      const result = truncateQuote(text, 30);
      expect(result.length).toBeLessThanOrEqual(32); // 30 + suffix
      expect(result).toEndWith("…");
    });

    test("respects custom maxLength", () => {
      const text = "a".repeat(500);
      const result = truncateQuote(text, 100);
      expect(result.length).toBeLessThanOrEqual(101);
    });
  });

  describe("hasQuote", () => {
    test("detects quoted content", () => {
      expect(hasQuote("> Some quote\nReply")).toBe(true);
    });

    test("returns false for non-quoted content", () => {
      expect(hasQuote("No quote here")).toBe(false);
    });

    test("detects mid-message quotes", () => {
      expect(hasQuote("Intro\n> Quoted line")).toBe(true);
    });
  });

  describe("extractReply", () => {
    test("extracts reply after quote", () => {
      const msg = "> **Alice** wrote:\n> Hello\n\nMy reply";
      expect(extractReply(msg)).toBe("My reply");
    });

    test("returns full content when no quote", () => {
      expect(extractReply("Just a message")).toBe("Just a message");
    });

    test("handles multiple blank lines after quote", () => {
      const msg = "> Quote\n\n\nReply";
      expect(extractReply(msg)).toBe("Reply");
    });
  });

  describe("parseQuoteBlock", () => {
    test("parses formatted quote block", () => {
      const msg = buildQuotedReply("Alice", "Hello", "My reply");
      const parsed = parseQuoteBlock(msg);
      expect(parsed).not.toBeNull();
      expect(parsed!.originalSender).toBe("Alice");
      expect(parsed!.quotedContent).toBe("Hello");
      expect(parsed!.replyContent).toBe("My reply");
      expect(parsed!.isTruncated).toBe(false);
    });

    test("returns null for non-quoted messages", () => {
      expect(parseQuoteBlock("Plain message")).toBeNull();
    });

    test("detects truncated quotes", () => {
      const longText = "word ".repeat(200);
      const msg = buildQuotedReply("Bob", longText, "Reply");
      const parsed = parseQuoteBlock(msg);
      expect(parsed!.isTruncated).toBe(true);
    });
  });

  describe("countQuotes", () => {
    test("counts zero for no quotes", () => {
      expect(countQuotes("No quotes")).toBe(0);
    });

    test("counts single quote", () => {
      const msg = buildQuotedReply("Alice", "Hi", "Reply");
      expect(countQuotes(msg)).toBe(1);
    });
  });

  describe("stripQuotes", () => {
    test("removes all quoted lines", () => {
      const msg = "> Quote line 1\n> Quote line 2\nReply text";
      expect(stripQuotes(msg)).toBe("Reply text");
    });

    test("returns content as-is when no quotes", () => {
      expect(stripQuotes("No quotes here")).toBe("No quotes here");
    });
  });
});
