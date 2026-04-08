import { describe, expect, it } from "vitest";
import { shouldAutoScroll } from "./autoscroll-threshold";

describe("shouldAutoScroll", () => {
  it("returns true when near bottom", () => {
    expect(shouldAutoScroll(880, 100, 1000)).toBe(true);
  });

  it("returns false when user scrolled up", () => {
    expect(shouldAutoScroll(500, 100, 1000)).toBe(false);
  });

  it("supports custom threshold", () => {
    expect(shouldAutoScroll(750, 100, 1000, 200)).toBe(true);
  });
});
