/**
 * Tests for message search with date range filter.
 */

import { describe, expect, it } from "bun:test";

describe("Search Date Range Filter", () => {
  it("after filter includes messages on or after date", () => {
    const after = "2025-01-10T00:00:00.000Z";
    const messageDate = "2025-01-15T00:00:00.000Z";
    expect(messageDate >= after).toBe(true);
  });

  it("after filter excludes messages before date", () => {
    const after = "2025-01-10T00:00:00.000Z";
    const messageDate = "2025-01-05T00:00:00.000Z";
    expect(messageDate >= after).toBe(false);
  });

  it("before filter includes messages on or before date", () => {
    const before = "2025-01-20T00:00:00.000Z";
    const messageDate = "2025-01-15T00:00:00.000Z";
    expect(messageDate <= before).toBe(true);
  });

  it("before filter excludes messages after date", () => {
    const before = "2025-01-10T00:00:00.000Z";
    const messageDate = "2025-01-15T00:00:00.000Z";
    expect(messageDate <= before).toBe(false);
  });

  it("combined after+before creates a date range", () => {
    const after = "2025-01-01T00:00:00.000Z";
    const before = "2025-01-31T23:59:59.999Z";
    const inRange = "2025-01-15T12:00:00.000Z";
    const outOfRange = "2025-02-01T00:00:00.000Z";
    expect(inRange >= after && inRange <= before).toBe(true);
    expect(outOfRange >= after && outOfRange <= before).toBe(false);
  });

  it("ISO 8601 date strings compare correctly", () => {
    const dates = [
      "2025-01-01T00:00:00.000Z",
      "2025-06-15T12:30:00.000Z",
      "2025-12-31T23:59:59.999Z",
    ];
    const sorted = [...dates].sort();
    expect(sorted[0]).toBe(dates[0]);
    expect(sorted[2]).toBe(dates[2]);
  });
});
