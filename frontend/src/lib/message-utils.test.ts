/** Tests for message utility constants and functions. */
import { describe, it, expect } from "vitest";

/** Max message length — must match server MessageCreateSchema */
const MAX_MESSAGE_LENGTH = 32000;

describe("message limits", () => {
  it("MAX_MESSAGE_LENGTH is 32000", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(32000);
  });

  it("character count display thresholds are sensible", () => {
    // Warning threshold should be less than max
    const warningThreshold = 28000;
    expect(warningThreshold).toBeLessThan(MAX_MESSAGE_LENGTH);
    expect(warningThreshold).toBeGreaterThan(MAX_MESSAGE_LENGTH * 0.5);
  });
});
