import { describe, it, expect } from "bun:test";
import { formatAbsoluteTime, formatShortTime, buildMessagePermalink } from "./timestamp-utils";

describe("formatAbsoluteTime", () => {
  it("formats a valid ISO timestamp", () => {
    const result = formatAbsoluteTime("2026-03-10T14:05:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("10");
  });

  it("returns raw string for invalid date", () => {
    expect(formatAbsoluteTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatShortTime", () => {
  it("formats time portion only", () => {
    const result = formatShortTime("2026-03-10T14:05:00Z");
    // Should contain time but not year
    expect(result.length).toBeLessThan(15);
    expect(result).not.toContain("2026");
  });

  it("returns raw string for invalid date", () => {
    expect(formatShortTime("bad")).toBe("bad");
  });
});

describe("buildMessagePermalink", () => {
  it("builds a permalink with channel and message", () => {
    const url = buildMessagePermalink("#general", "msg-123");
    expect(url).toContain("channel=%23general");
    expect(url).toContain("message=msg-123");
  });

  it("encodes special characters", () => {
    const url = buildMessagePermalink("#my channel", "abc&def");
    expect(url).toContain("channel=%23my%20channel");
    expect(url).toContain("message=abc%26def");
  });
});
