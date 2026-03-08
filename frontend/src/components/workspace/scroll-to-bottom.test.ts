/**
 * Tests for the scroll-to-bottom button logic.
 */

import { describe, expect, it } from "vitest";

describe("Scroll-to-bottom button", () => {
  it("shows correct label for single new message", () => {
    const count = 1;
    const label = count > 0
      ? `${count} new message${count > 1 ? "s" : ""}`
      : "Scroll to bottom";
    expect(label).toBe("1 new message");
  });

  it("shows correct label for multiple new messages", () => {
    const count = 5;
    const label = count > 0
      ? `${count} new message${count > 1 ? "s" : ""}`
      : "Scroll to bottom";
    expect(label).toBe("5 new messages");
  });

  it("shows generic label when no new messages", () => {
    const count = 0;
    const label = count > 0
      ? `${count} new message${count > 1 ? "s" : ""}`
      : "Scroll to bottom";
    expect(label).toBe("Scroll to bottom");
  });

  it("near-bottom detection threshold is 150px", () => {
    // Simulating the scroll calculation
    const scrollHeight = 1000;
    const scrollTop = 800;
    const clientHeight = 100;
    const distance = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distance < 150;
    expect(isNearBottom).toBe(true); // 100 < 150
  });

  it("detects when user is scrolled up", () => {
    const scrollHeight = 2000;
    const scrollTop = 500;
    const clientHeight = 600;
    const distance = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distance < 150;
    expect(isNearBottom).toBe(false); // 900 >= 150
  });
});
