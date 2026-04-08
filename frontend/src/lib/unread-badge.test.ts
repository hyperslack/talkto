import { describe, expect, it } from "vitest";
import { formatUnreadBadge } from "./unread-badge";

describe("formatUnreadBadge", () => {
  it("returns empty string for zero or negative counts", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(-5)).toBe("");
  });

  it("returns exact count up to 99", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(42)).toBe("42");
    expect(formatUnreadBadge(99)).toBe("99");
  });

  it("caps at 99+ for large counts", () => {
    expect(formatUnreadBadge(100)).toBe("99+");
    expect(formatUnreadBadge(999)).toBe("99+");
  });

  it("guards against invalid numbers", () => {
    expect(formatUnreadBadge(Number.NaN)).toBe("");
    expect(formatUnreadBadge(Number.POSITIVE_INFINITY)).toBe("");
  });
});
