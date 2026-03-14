import { describe, expect, test } from "bun:test";
import {
  truncateAtWord,
  stripCodeBlocks,
  collapseWhitespace,
  generatePreview,
  countLines,
  shouldCollapse,
  firstLine,
} from "../src/utils/message-truncation";

describe("truncateAtWord", () => {
  test("returns empty string for empty input", () => {
    const result = truncateAtWord("", 100);
    expect(result.text).toBe("");
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(0);
  });

  test("returns content unchanged when under limit", () => {
    const result = truncateAtWord("hello world", 100);
    expect(result.text).toBe("hello world");
    expect(result.truncated).toBe(false);
  });

  test("truncates at word boundary with ellipsis", () => {
    const result = truncateAtWord("hello beautiful world today", 20);
    expect(result.text).toBe("hello beautiful…");
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(27);
  });

  test("truncates at maxLength when no good word break", () => {
    const result = truncateAtWord("abcdefghijklmnop", 10);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(11); // +1 for ellipsis
  });

  test("uses default maxLength of 100", () => {
    const long = "word ".repeat(30);
    const result = truncateAtWord(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(101);
  });
});

describe("stripCodeBlocks", () => {
  test("replaces fenced code blocks with [code]", () => {
    const content = "before ```js\nconsole.log('hi')\n``` after";
    expect(stripCodeBlocks(content)).toBe("before [code] after");
  });

  test("replaces inline code with [code]", () => {
    expect(stripCodeBlocks("use `npm install` here")).toBe("use [code] here");
  });

  test("handles multiple code blocks", () => {
    const content = "a ```x``` b `y` c";
    expect(stripCodeBlocks(content)).toBe("a [code] b [code] c");
  });

  test("returns content unchanged when no code", () => {
    expect(stripCodeBlocks("plain text")).toBe("plain text");
  });
});

describe("collapseWhitespace", () => {
  test("collapses multiple newlines to space", () => {
    expect(collapseWhitespace("a\n\n\nb")).toBe("a b");
  });

  test("collapses multiple spaces", () => {
    expect(collapseWhitespace("a    b")).toBe("a b");
  });

  test("trims leading/trailing whitespace", () => {
    expect(collapseWhitespace("  hello  ")).toBe("hello");
  });
});

describe("generatePreview", () => {
  test("creates clean preview from complex content", () => {
    const content = "Check this:\n\n```js\nconst x = 1;\n```\n\nThen do more things with the result of the computation above.";
    const result = generatePreview(content, 60);
    expect(result.text).not.toContain("```");
    expect(result.text).not.toContain("\n");
    expect(result.truncated).toBe(true);
  });

  test("short message returns unchanged (after cleanup)", () => {
    const result = generatePreview("hello");
    expect(result.text).toBe("hello");
    expect(result.truncated).toBe(false);
  });
});

describe("countLines", () => {
  test("counts single line", () => {
    expect(countLines("hello")).toBe(1);
  });

  test("counts multiple lines", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });

  test("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });
});

describe("shouldCollapse", () => {
  test("returns false for short content", () => {
    expect(shouldCollapse("hello")).toBe(false);
  });

  test("returns true for long content", () => {
    expect(shouldCollapse("x".repeat(501))).toBe(true);
  });

  test("returns true for many lines", () => {
    expect(shouldCollapse("line\n".repeat(11))).toBe(true);
  });

  test("respects custom thresholds", () => {
    expect(shouldCollapse("hello world", { maxLength: 5 })).toBe(true);
    expect(shouldCollapse("a\nb\nc", { maxLines: 2 })).toBe(true);
  });

  test("returns false for empty/null content", () => {
    expect(shouldCollapse("")).toBe(false);
  });
});

describe("firstLine", () => {
  test("extracts first line", () => {
    expect(firstLine("hello\nworld")).toBe("hello");
  });

  test("truncates long first line", () => {
    const long = "word ".repeat(20);
    const result = firstLine(long, 30);
    expect(result.length).toBeLessThanOrEqual(31);
  });

  test("returns empty for empty input", () => {
    expect(firstLine("")).toBe("");
  });
});
