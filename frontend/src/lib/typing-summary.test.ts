import { describe, expect, it } from "vitest";
import { formatTypingSummary } from "./typing-summary";

describe("formatTypingSummary", () => {
  it("handles empty", () => {
    expect(formatTypingSummary([])).toBe("");
  });

  it("handles one and two users", () => {
    expect(formatTypingSummary(["Nelly"])).toBe("Nelly is typing…");
    expect(formatTypingSummary(["Nelly", "Yash"])).toBe("Nelly and Yash are typing…");
  });

  it("collapses long lists", () => {
    expect(formatTypingSummary(["A", "B", "C"])).toBe("A, B, and 1 others are typing…");
  });
});
