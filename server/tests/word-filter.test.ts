import { describe, test, expect } from "bun:test";
import {
  WordFilter,
  censorWord,
  createFilterFromList,
} from "../src/lib/word-filter";

describe("WordFilter", () => {
  test("replaces matched words", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "bad", action: "replace", replacement: "***" });
    const result = filter.apply("This is bad content");
    expect(result.filtered).toBe("This is *** content");
    expect(result.matched).toHaveLength(1);
  });

  test("blocks content with blocked words", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "spam", action: "block" });
    const result = filter.apply("This is spam content");
    expect(result.blocked).toBe(true);
  });

  test("flags content without modifying", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "suspicious", action: "flag" });
    const result = filter.apply("Something suspicious here");
    expect(result.flagged).toBe(true);
    expect(result.filtered).toBe("Something suspicious here");
  });

  test("case insensitive by default", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "bad", action: "replace", replacement: "***" });
    const result = filter.apply("This is BAD");
    expect(result.filtered).toBe("This is ***");
  });

  test("respects case sensitivity flag", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "Bad", action: "replace", replacement: "***", caseSensitive: true });
    const result = filter.apply("This is bad but Bad is caught");
    expect(result.filtered).toContain("bad");
    expect(result.filtered).toContain("***");
  });

  test("uses asterisk replacement when none specified", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "test", action: "replace" });
    const result = filter.apply("This is a test");
    expect(result.filtered).toBe("This is a ****");
  });

  test("handles multiple rules", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "bad", action: "replace", replacement: "[x]" });
    filter.addRule({ pattern: "ugly", action: "replace", replacement: "[x]" });
    const result = filter.apply("bad and ugly content");
    expect(result.filtered).toBe("[x] and [x] content");
    expect(result.matched).toHaveLength(2);
  });

  test("containsBlocked returns true for blocked words", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "spam", action: "block" });
    filter.addRule({ pattern: "mild", action: "replace" });
    expect(filter.containsBlocked("This is spam")).toBe(true);
    expect(filter.containsBlocked("This is mild")).toBe(false);
  });

  test("removeRule works", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "test", action: "block" });
    expect(filter.removeRule("test")).toBe(true);
    expect(filter.ruleCount()).toBe(0);
  });

  test("removeRule returns false for missing", () => {
    const filter = new WordFilter();
    expect(filter.removeRule("nonexistent")).toBe(false);
  });

  test("clear removes all rules", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "a", action: "block" });
    filter.addRule({ pattern: "b", action: "block" });
    filter.clear();
    expect(filter.ruleCount()).toBe(0);
  });

  test("does not match partial words", () => {
    const filter = new WordFilter();
    filter.addRule({ pattern: "ass", action: "block" });
    const result = filter.apply("assistant is great");
    expect(result.blocked).toBe(false);
  });
});

describe("censorWord", () => {
  test("censors middle characters", () => {
    expect(censorWord("hello")).toBe("h***o");
  });

  test("handles single character", () => {
    expect(censorWord("x")).toBe("*");
  });

  test("handles two characters", () => {
    expect(censorWord("hi")).toBe("hi");
  });
});

describe("createFilterFromList", () => {
  test("creates filter with all words as replace", () => {
    const filter = createFilterFromList(["bad", "ugly"]);
    expect(filter.ruleCount()).toBe(2);
    const result = filter.apply("That was bad");
    expect(result.filtered).not.toContain("bad");
  });

  test("supports custom action", () => {
    const filter = createFilterFromList(["spam"], "block");
    expect(filter.containsBlocked("This is spam")).toBe(true);
  });
});
