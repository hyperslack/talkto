/**
 * Tests for code block extraction utilities.
 */

import { describe, expect, it } from "bun:test";
import {
  extractCodeBlocks,
  hasCodeBlocks,
  countCodeBlocks,
  getLanguages,
} from "../src/utils/code-blocks";

describe("extractCodeBlocks", () => {
  it("extracts a single code block with language", () => {
    const content = "Here is some code:\n```typescript\nconst x = 1;\n```\nDone.";
    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("typescript");
    expect(blocks[0].code).toBe("const x = 1;");
  });

  it("extracts a code block without language", () => {
    const content = "```\nhello world\n```";
    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBeNull();
    expect(blocks[0].code).toBe("hello world");
  });

  it("extracts multiple code blocks", () => {
    const content = "```js\nfoo()\n```\ntext\n```python\nbar()\n```";
    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("js");
    expect(blocks[1].language).toBe("python");
  });

  it("returns empty array for no code blocks", () => {
    expect(extractCodeBlocks("just text")).toHaveLength(0);
  });

  it("includes start and end indices", () => {
    const content = "abc ```\ncode\n``` def";
    const blocks = extractCodeBlocks(content);
    expect(blocks[0].startIndex).toBe(4);
    expect(blocks[0].endIndex).toBeGreaterThan(blocks[0].startIndex);
  });
});

describe("hasCodeBlocks", () => {
  it("returns true when code blocks exist", () => {
    expect(hasCodeBlocks("```\ncode\n```")).toBe(true);
  });

  it("returns false when no code blocks", () => {
    expect(hasCodeBlocks("no code here")).toBe(false);
  });
});

describe("countCodeBlocks", () => {
  it("counts correctly", () => {
    expect(countCodeBlocks("```\na\n```\n```\nb\n```")).toBe(2);
    expect(countCodeBlocks("nothing")).toBe(0);
  });
});

describe("getLanguages", () => {
  it("returns unique sorted languages", () => {
    const blocks = extractCodeBlocks("```python\na\n```\n```js\nb\n```\n```python\nc\n```");
    expect(getLanguages(blocks)).toEqual(["js", "python"]);
  });

  it("excludes null languages", () => {
    const blocks = extractCodeBlocks("```\na\n```");
    expect(getLanguages(blocks)).toEqual([]);
  });
});
