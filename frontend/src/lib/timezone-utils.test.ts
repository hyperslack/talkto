/**
 * Tests for timezone utilities.
 */

import { describe, expect, it } from "bun:test";
import {
  getLocalTimezone,
  formatInTimezone,
  getUtcOffset,
  hourDifference,
  isValidTimezone,
  commonTimezones,
} from "./timezone-utils";

describe("getLocalTimezone", () => {
  it("returns a non-empty string", () => {
    const tz = getLocalTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe("formatInTimezone", () => {
  it("formats a timestamp in a given timezone", () => {
    const result = formatInTimezone("2026-01-15T12:00:00Z", "UTC");
    expect(result).toContain("12");
    expect(result).toContain("00");
  });

  it("produces different output for different timezones", () => {
    const utc = formatInTimezone("2026-01-15T12:00:00Z", "UTC");
    const tokyo = formatInTimezone("2026-01-15T12:00:00Z", "Asia/Tokyo");
    expect(utc).not.toBe(tokyo);
  });
});

describe("getUtcOffset", () => {
  it("returns +00:00 for UTC", () => {
    expect(getUtcOffset("UTC")).toBe("+00:00");
  });

  it("returns a valid offset format", () => {
    const offset = getUtcOffset("America/New_York");
    expect(offset).toMatch(/^[+-]\d{2}:\d{2}$/);
  });
});

describe("hourDifference", () => {
  it("returns 0 for same timezone", () => {
    expect(hourDifference("UTC", "UTC")).toBe(0);
  });

  it("returns non-zero for different timezones", () => {
    const diff = hourDifference("UTC", "Asia/Tokyo");
    expect(diff).toBe(9);
  });
});

describe("isValidTimezone", () => {
  it("returns true for valid timezone", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("returns false for invalid timezone", () => {
    expect(isValidTimezone("Not/A/Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("commonTimezones", () => {
  it("returns a non-empty list of timezone options", () => {
    const tzs = commonTimezones();
    expect(tzs.length).toBeGreaterThan(10);
    expect(tzs[0]).toHaveProperty("value");
    expect(tzs[0]).toHaveProperty("label");
  });
});
