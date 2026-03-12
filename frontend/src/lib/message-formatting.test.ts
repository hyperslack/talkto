/**
 * Tests for message formatting utilities.
 */

import { describe, expect, it } from "bun:test";
import {
  applyBold,
  applyItalic,
  applyStrikethrough,
  applyInlineCode,
  applyCodeBlock,
  applyBlockquote,
  hasFormatting,
  stripFormatting,
  wrapSelection,
} from "./message-formatting";

describe("wrapSelection", () => {
  it("wraps selected text with delimiter", () => {
    const result = wrapSelection("hello world", { start: 6, end: 11 }, "**");
    expect(result.text).toBe("hello **world**");
  });

  it("inserts empty delimiters when no selection", () => {
    const result = wrapSelection("hello ", { start: 6, end: 6 }, "**");
    expect(result.text).toBe("hello ****");
    expect(result.cursor).toBe(8); // between the delimiters
  });
});

describe("applyBold", () => {
  it("bolds selected text", () => {
    const result = applyBold("make this bold", { start: 10, end: 14 });
    expect(result.text).toBe("make this **bold**");
  });
});

describe("applyItalic", () => {
  it("italicizes selected text", () => {
    const result = applyItalic("make italic", { start: 5, end: 11 });
    expect(result.text).toBe("make *italic*");
  });
});

describe("applyStrikethrough", () => {
  it("applies strikethrough", () => {
    const result = applyStrikethrough("remove this", { start: 7, end: 11 });
    expect(result.text).toBe("remove ~~this~~");
  });
});

describe("applyInlineCode", () => {
  it("wraps in backticks", () => {
    const result = applyInlineCode("run code here", { start: 4, end: 8 });
    expect(result.text).toBe("run `code` here");
  });
});

describe("applyCodeBlock", () => {
  it("wraps in fenced code block", () => {
    const result = applyCodeBlock("const x = 1", { start: 0, end: 11 });
    expect(result.text).toBe("```\nconst x = 1\n```");
  });

  it("includes language tag", () => {
    const result = applyCodeBlock("const x = 1", { start: 0, end: 11 }, "ts");
    expect(result.text).toBe("```ts\nconst x = 1\n```");
  });

  it("inserts empty code block when no selection", () => {
    const result = applyCodeBlock("", { start: 0, end: 0 });
    expect(result.text).toBe("```\n\n```");
  });
});

describe("applyBlockquote", () => {
  it("prefixes lines with >", () => {
    const result = applyBlockquote("line1\nline2", { start: 0, end: 11 });
    expect(result.text).toBe("> line1\n> line2");
  });
});

describe("hasFormatting", () => {
  it("detects bold", () => expect(hasFormatting("**bold**")).toBe(true));
  it("detects italic", () => expect(hasFormatting("*italic*")).toBe(true));
  it("detects code", () => expect(hasFormatting("`code`")).toBe(true));
  it("returns false for plain text", () => expect(hasFormatting("hello")).toBe(false));
});

describe("stripFormatting", () => {
  it("strips bold", () => expect(stripFormatting("**bold**")).toBe("bold"));
  it("strips italic", () => expect(stripFormatting("*italic*")).toBe("italic"));
  it("strips strikethrough", () => expect(stripFormatting("~~gone~~")).toBe("gone"));
  it("strips inline code", () => expect(stripFormatting("`code`")).toBe("code"));
  it("strips blockquote", () => expect(stripFormatting("> quoted")).toBe("quoted"));
});
