import { describe, expect, it } from "vitest";
import { formatReactionTooltip } from "./reaction-tooltip";

describe("formatReactionTooltip", () => {
  it("returns empty-state copy", () => {
    expect(formatReactionTooltip([])).toBe("No reactions yet");
  });

  it("shows all names when short", () => {
    expect(formatReactionTooltip(["A", "B"])).toBe("A, B");
  });

  it("truncates long lists", () => {
    expect(formatReactionTooltip(["A", "B", "C", "D"])).toBe("A, B, C, and 1 more");
  });
});
