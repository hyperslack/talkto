import { describe, test, expect } from "bun:test";
import {
  computeDiff,
  summarizeEdit,
  formatInlineDiff,
  isIdentical,
} from "../src/lib/edit-diff";

describe("computeDiff", () => {
  test("returns empty segments for identical text", () => {
    const diff = computeDiff("hello world", "hello world");
    expect(diff.every((s) => s.type === "equal")).toBe(true);
  });

  test("detects insertions", () => {
    const diff = computeDiff("hello", "hello world");
    expect(diff.some((s) => s.type === "insert")).toBe(true);
  });

  test("detects deletions", () => {
    const diff = computeDiff("hello world", "hello");
    expect(diff.some((s) => s.type === "delete")).toBe(true);
  });

  test("detects replacements as delete+insert", () => {
    const diff = computeDiff("hello world", "hello earth");
    const types = diff.map((s) => s.type);
    expect(types).toContain("delete");
    expect(types).toContain("insert");
  });

  test("handles empty old text", () => {
    const diff = computeDiff("", "new text");
    expect(diff.some((s) => s.type === "insert")).toBe(true);
  });

  test("handles empty new text", () => {
    const diff = computeDiff("old text", "");
    expect(diff.some((s) => s.type === "delete")).toBe(true);
  });
});

describe("summarizeEdit", () => {
  test("reports no changes for identical text", () => {
    const summary = summarizeEdit("hello", "hello");
    expect(summary.charsAdded).toBe(0);
    expect(summary.charsRemoved).toBe(0);
    expect(summary.description).toBe("No changes");
  });

  test("reports additions only", () => {
    const summary = summarizeEdit("hello", "hello world");
    expect(summary.charsAdded).toBeGreaterThan(0);
    expect(summary.description).toContain("Added");
  });

  test("reports removals only", () => {
    const summary = summarizeEdit("hello world", "hello");
    expect(summary.charsRemoved).toBeGreaterThan(0);
    expect(summary.description).toContain("Removed");
  });

  test("reports mixed changes", () => {
    const summary = summarizeEdit("the quick fox", "a slow fox");
    expect(summary.charsAdded).toBeGreaterThan(0);
    expect(summary.charsRemoved).toBeGreaterThan(0);
    expect(summary.description).toContain("Changed");
  });

  test("marks small edits as minor", () => {
    const summary = summarizeEdit("hello", "helo");
    expect(summary.isMinor).toBe(true);
  });

  test("marks large edits as non-minor", () => {
    const summary = summarizeEdit("short", "a completely different and much longer message");
    expect(summary.isMinor).toBe(false);
  });
});

describe("formatInlineDiff", () => {
  test("formats deletions with markers", () => {
    const diff = computeDiff("hello world", "hello");
    const formatted = formatInlineDiff(diff);
    expect(formatted).toContain("[-");
    expect(formatted).toContain("-]");
  });

  test("formats insertions with markers", () => {
    const diff = computeDiff("hello", "hello world");
    const formatted = formatInlineDiff(diff);
    expect(formatted).toContain("[+");
    expect(formatted).toContain("+]");
  });

  test("shows equal parts without markers", () => {
    const diff = computeDiff("hello world", "hello world");
    const formatted = formatInlineDiff(diff);
    expect(formatted).not.toContain("[+");
    expect(formatted).not.toContain("[-");
  });
});

describe("isIdentical", () => {
  test("treats identical text as identical", () => {
    expect(isIdentical("hello", "hello")).toBe(true);
  });

  test("normalizes whitespace differences", () => {
    expect(isIdentical("hello  world", "hello world")).toBe(true);
  });

  test("detects actual differences", () => {
    expect(isIdentical("hello", "world")).toBe(false);
  });

  test("ignores leading/trailing whitespace", () => {
    expect(isIdentical("  hello  ", "hello")).toBe(true);
  });
});
