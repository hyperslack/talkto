/**
 * Tests for date formatting utilities.
 */

import { describe, expect, it } from "bun:test";
import { formatRelative, formatAbsolute, formatDate } from "../src/utils/date-format";

const now = new Date("2025-06-15T12:00:00.000Z");

describe("Date Formatting", () => {
  it("formats seconds ago as 'just now'", () => {
    expect(formatRelative("2025-06-15T11:59:45.000Z", now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    expect(formatRelative("2025-06-15T11:55:00.000Z", now)).toBe("5 minutes ago");
  });

  it("formats 1 minute ago (singular)", () => {
    expect(formatRelative("2025-06-15T11:59:00.000Z", now)).toBe("1 minute ago");
  });

  it("formats hours ago", () => {
    expect(formatRelative("2025-06-15T09:00:00.000Z", now)).toBe("3 hours ago");
  });

  it("formats days ago", () => {
    expect(formatRelative("2025-06-13T12:00:00.000Z", now)).toBe("2 days ago");
  });

  it("formats weeks ago", () => {
    expect(formatRelative("2025-05-25T12:00:00.000Z", now)).toBe("3 weeks ago");
  });

  it("formats months ago", () => {
    expect(formatRelative("2025-03-15T12:00:00.000Z", now)).toBe("3 months ago");
  });

  it("formats years ago", () => {
    expect(formatRelative("2023-06-15T12:00:00.000Z", now)).toBe("2 years ago");
  });

  it("formats future dates as 'just now'", () => {
    expect(formatRelative("2025-06-16T12:00:00.000Z", now)).toBe("just now");
  });

  it("formats absolute date correctly", () => {
    expect(formatAbsolute("2025-01-15T10:30:00.000Z")).toBe("Jan 15, 2025");
  });

  it("formats absolute date for December", () => {
    expect(formatAbsolute("2025-12-31T23:59:59.000Z")).toBe("Dec 31, 2025");
  });

  it("formatDate returns both relative and absolute", () => {
    const result = formatDate("2025-06-13T12:00:00.000Z", now);
    expect(result.relative).toBe("2 days ago");
    expect(result.absolute).toBe("Jun 13, 2025");
  });
});
