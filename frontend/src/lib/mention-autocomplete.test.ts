import { describe, it, expect } from "bun:test";
import { detectMention, filterCandidates, applyMention } from "./mention-autocomplete";
import type { MentionCandidate } from "./mention-autocomplete";

describe("detectMention", () => {
  it("detects @ at start of input", () => {
    const result = detectMention("@bo", 3);
    expect(result).toEqual({ query: "bo", startIndex: 0 });
  });

  it("detects @ after space", () => {
    const result = detectMention("hello @wo", 9);
    expect(result).toEqual({ query: "wo", startIndex: 6 });
  });

  it("returns null when no @", () => {
    expect(detectMention("hello world", 11)).toBeNull();
  });

  it("returns null when @ is mid-word", () => {
    expect(detectMention("email@test", 10)).toBeNull();
  });

  it("returns null when query has spaces", () => {
    expect(detectMention("@hello world", 12)).toBeNull();
  });

  it("returns empty query for just @", () => {
    const result = detectMention("@", 1);
    expect(result).toEqual({ query: "", startIndex: 0 });
  });
});

describe("filterCandidates", () => {
  const candidates: MentionCandidate[] = [
    { name: "alice", displayName: "Alice Smith", type: "human" },
    { name: "bob-agent", displayName: "Bob", type: "agent" },
    { name: "charlie", displayName: null, type: "human" },
  ];

  it("returns all for empty query", () => {
    expect(filterCandidates(candidates, "")).toHaveLength(3);
  });

  it("filters by name", () => {
    const results = filterCandidates(candidates, "ali");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("alice");
  });

  it("filters by display name", () => {
    const results = filterCandidates(candidates, "smith");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("alice");
  });

  it("is case-insensitive", () => {
    expect(filterCandidates(candidates, "BOB")).toHaveLength(1);
  });

  it("respects limit", () => {
    expect(filterCandidates(candidates, "", 2)).toHaveLength(2);
  });
});

describe("applyMention", () => {
  it("replaces @query with @name", () => {
    const match = { query: "bo", startIndex: 6 };
    const result = applyMention("hello @bo", match, "bob-agent");
    expect(result).toBe("hello @bob-agent ");
  });

  it("works at start of input", () => {
    const match = { query: "al", startIndex: 0 };
    const result = applyMention("@al", match, "alice");
    expect(result).toBe("@alice ");
  });

  it("preserves text after mention", () => {
    const match = { query: "bo", startIndex: 0 };
    const result = applyMention("@bo test", match, "bob");
    expect(result).toBe("@bob  test");
  });
});
