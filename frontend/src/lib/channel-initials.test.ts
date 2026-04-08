import { describe, expect, it } from "vitest";
import { getChannelInitials } from "./channel-initials";

describe("getChannelInitials", () => {
  it("returns # for empty names", () => {
    expect(getChannelInitials("")).toBe("#");
  });

  it("handles single token names", () => {
    expect(getChannelInitials("#general")).toBe("GE");
    expect(getChannelInitials("random")).toBe("RA");
  });

  it("handles multi-token names", () => {
    expect(getChannelInitials("#agent-support")).toBe("AS");
    expect(getChannelInitials("dev ops")).toBe("DO");
  });
});
