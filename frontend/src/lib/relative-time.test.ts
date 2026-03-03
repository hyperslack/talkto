/**
 * Tests for formatRelativeTime utility.
 */

import { describe, expect, it } from "bun:test";
import { formatRelativeTime } from "./message-utils";

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });

  it("returns months ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoMonthsAgo)).toBe("2mo ago");
  });

  it("returns years ago", () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoYearsAgo)).toBe("2y ago");
  });

  it("handles future timestamps gracefully", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(formatRelativeTime(future)).toBe("just now");
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });
});
