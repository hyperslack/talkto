import { describe, it, expect } from "bun:test";
import {
  analyzeContent,
  isEmojiOnly,
  isLinkOnly,
  getRenderMode,
} from "../src/utils/content-type-detection";

describe("analyzeContent", () => {
  it("detects plain text", () => {
    const result = analyzeContent("Hello world");
    expect(result.type).toBe("text");
    expect(result.wordCount).toBe(2);
    expect(result.lineCount).toBe(1);
    expect(result.isShort).toBe(true);
  });

  it("detects emoji-only content", () => {
    const result = analyzeContent("👍🎉");
    expect(result.type).toBe("emoji_only");
    expect(result.hasEmoji).toBe(true);
  });

  it("detects code blocks", () => {
    const result = analyzeContent("Check this:\n```js\nconsole.log('hi')\n```");
    expect(result.type).toBe("code_block");
    expect(result.hasCodeBlocks).toBe(true);
  });

  it("detects link-only content", () => {
    const result = analyzeContent("https://github.com/hyperslack/talkto");
    expect(result.type).toBe("link_only");
    expect(result.hasLinks).toBe(true);
  });

  it("detects mentions", () => {
    const result = analyzeContent("Hey @alice check this");
    expect(result.hasMentions).toBe(true);
  });

  it("counts lines correctly", () => {
    const result = analyzeContent("line1\nline2\nline3");
    expect(result.lineCount).toBe(3);
  });

  it("marks long content as not short", () => {
    const result = analyzeContent("a".repeat(100));
    expect(result.isShort).toBe(false);
  });

  it("handles empty content", () => {
    const result = analyzeContent("");
    expect(result.type).toBe("text");
    expect(result.wordCount).toBe(0);
    expect(result.lineCount).toBe(0);
  });

  it("detects inline code", () => {
    const result = analyzeContent("`foo`");
    expect(result.hasInlineCode).toBe(true);
  });
});

describe("isEmojiOnly", () => {
  it("returns true for emoji string", () => {
    expect(isEmojiOnly("😀")).toBe(true);
    expect(isEmojiOnly("👍 🎉")).toBe(true);
  });

  it("returns false for text with emoji", () => {
    expect(isEmojiOnly("hello 😀")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEmojiOnly("")).toBe(false);
  });

  it("returns false for very long emoji strings", () => {
    expect(isEmojiOnly("😀".repeat(50))).toBe(false);
  });
});

describe("isLinkOnly", () => {
  it("returns true for bare URL", () => {
    expect(isLinkOnly("https://example.com")).toBe(true);
  });

  it("returns false for URL with text", () => {
    expect(isLinkOnly("Check https://example.com")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isLinkOnly("hello world")).toBe(false);
  });
});

describe("getRenderMode", () => {
  it("returns large_emoji for emoji-only", () => {
    expect(getRenderMode("🎉")).toBe("large_emoji");
  });

  it("returns code for code blocks", () => {
    expect(getRenderMode("```\ncode\n```")).toBe("code");
  });

  it("returns link_preview for bare URLs", () => {
    expect(getRenderMode("https://example.com")).toBe("link_preview");
  });

  it("returns default for plain text", () => {
    expect(getRenderMode("Hello world")).toBe("default");
  });
});
