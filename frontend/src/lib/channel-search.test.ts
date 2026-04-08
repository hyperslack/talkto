import { describe, expect, it } from "vitest";
import { matchesChannelSearch } from "./channel-search";

describe("matchesChannelSearch", () => {
  it("matches case-insensitively", () => {
    expect(matchesChannelSearch("#General", "gen")).toBe(true);
  });

  it("normalizes hash prefixes", () => {
    expect(matchesChannelSearch("#devops", "#dev")).toBe(true);
  });

  it("returns true for empty queries", () => {
    expect(matchesChannelSearch("#random", "")).toBe(true);
  });

  it("returns false when unmatched", () => {
    expect(matchesChannelSearch("#backend", "frontend")).toBe(false);
  });
});
