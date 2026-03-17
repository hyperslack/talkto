import { describe, it, expect } from "vitest";
import {
  hasCodeBlock,
  hasInlineCode,
  isEmojiOnly,
  isSingleLine,
  lineCount,
  extractUrls,
  convertEmoticons,
  heightClass,
  shouldCollapse,
  plainTextPreview,
  detectContentType,
} from "../src/utils/content-renderer";

describe("hasCodeBlock", () => {
  it("detects fenced code blocks", () => {
    expect(hasCodeBlock("```js\nconsole.log('hi')\n```")).toBe(true);
  });

  it("returns false for no code blocks", () => {
    expect(hasCodeBlock("just text")).toBe(false);
  });
});

describe("hasInlineCode", () => {
  it("detects inline code", () => {
    expect(hasInlineCode("use `npm install`")).toBe(true);
  });

  it("returns false for no inline code", () => {
    expect(hasInlineCode("no code here")).toBe(false);
  });
});

describe("isEmojiOnly", () => {
  it("detects single emoji", () => {
    expect(isEmojiOnly("👍")).toBe(true);
  });

  it("detects multiple emojis", () => {
    expect(isEmojiOnly("🔥❤️")).toBe(true);
  });

  it("returns false for text", () => {
    expect(isEmojiOnly("hello 👍")).toBe(false);
  });
});

describe("isSingleLine", () => {
  it("true for single line", () => {
    expect(isSingleLine("hello world")).toBe(true);
  });

  it("false for multiline", () => {
    expect(isSingleLine("hello\nworld")).toBe(false);
  });
});

describe("lineCount", () => {
  it("counts lines", () => {
    expect(lineCount("a\nb\nc")).toBe(3);
  });

  it("returns 0 for empty", () => {
    expect(lineCount("")).toBe(0);
  });
});

describe("extractUrls", () => {
  it("extracts URLs", () => {
    const urls = extractUrls("check https://example.com and http://test.org");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://example.com");
  });

  it("returns empty for no URLs", () => {
    expect(extractUrls("no links")).toEqual([]);
  });
});

describe("convertEmoticons", () => {
  it("converts :) to emoji", () => {
    expect(convertEmoticons("hello :) there")).toContain("🙂");
  });

  it("converts <3 to heart", () => {
    expect(convertEmoticons("love <3")).toContain("❤️");
  });

  it("leaves non-emoticons alone", () => {
    expect(convertEmoticons("normal text")).toBe("normal text");
  });
});

describe("heightClass", () => {
  it("compact for short single line", () => {
    expect(heightClass("hello")).toBe("compact");
  });

  it("normal for a few lines", () => {
    expect(heightClass("a\nb\nc")).toBe("normal");
  });

  it("tall for many lines", () => {
    expect(heightClass("a\n".repeat(10))).toBe("tall");
  });
});

describe("shouldCollapse", () => {
  it("false for short content", () => {
    expect(shouldCollapse("short")).toBe(false);
  });

  it("true for very long content", () => {
    expect(shouldCollapse("line\n".repeat(20))).toBe(true);
  });
});

describe("plainTextPreview", () => {
  it("strips markdown formatting", () => {
    expect(plainTextPreview("**bold** and _italic_")).toBe("bold and italic");
  });

  it("replaces code blocks", () => {
    expect(plainTextPreview("```js\ncode\n```")).toBe("[code]");
  });

  it("truncates long text", () => {
    const result = plainTextPreview("x".repeat(200), 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toContain("...");
  });
});

describe("detectContentType", () => {
  it("detects emoji", () => {
    expect(detectContentType("🔥")).toBe("emoji");
  });

  it("detects code", () => {
    expect(detectContentType("```js\ncode\n```")).toBe("code");
  });

  it("detects link", () => {
    expect(detectContentType("https://example.com")).toBe("link");
  });

  it("detects text", () => {
    expect(detectContentType("hello world")).toBe("text");
  });
});
