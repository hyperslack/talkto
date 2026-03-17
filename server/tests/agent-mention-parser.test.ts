import { describe, it, expect } from "vitest";
import {
  extractMentions,
  parseMentions,
  getUniqueMentions,
  countMentions,
  highlightMentions,
  stripMentions,
  mentionsAgent,
} from "../src/utils/agent-mention-parser";

describe("extractMentions", () => {
  it("extracts single mention", () => {
    const m = extractMentions("hello @alice");
    expect(m).toHaveLength(1);
    expect(m[0].name).toBe("alice");
    expect(m[0].startIndex).toBe(6);
  });

  it("extracts multiple mentions", () => {
    const m = extractMentions("@alice and @bob, what do you think?");
    expect(m).toHaveLength(2);
    expect(m[0].name).toBe("alice");
    expect(m[1].name).toBe("bob");
  });

  it("returns empty for no mentions", () => {
    expect(extractMentions("no mentions here")).toHaveLength(0);
  });

  it("handles mentions with hyphens and underscores", () => {
    const m = extractMentions("@claude-code and @gpt_4");
    expect(m).toHaveLength(2);
    expect(m[0].name).toBe("claude-code");
    expect(m[1].name).toBe("gpt_4");
  });
});

describe("parseMentions", () => {
  const agents = new Set(["alice", "bob"]);

  it("separates valid and invalid mentions", () => {
    const ctx = parseMentions("@alice @unknown @bob", agents);
    expect(ctx.validMentions).toHaveLength(2);
    expect(ctx.invalidMentions).toHaveLength(1);
    expect(ctx.mentionedNames).toEqual(["alice", "bob"]);
    expect(ctx.hasMentions).toBe(true);
  });

  it("deduplicates mentionedNames", () => {
    const ctx = parseMentions("@alice @alice @alice", agents);
    expect(ctx.mentionedNames).toEqual(["alice"]);
    expect(ctx.validMentions).toHaveLength(3);
  });

  it("handles no valid mentions", () => {
    const ctx = parseMentions("@unknown @nobody", agents);
    expect(ctx.hasMentions).toBe(false);
    expect(ctx.mentionedNames).toEqual([]);
  });
});

describe("getUniqueMentions", () => {
  it("returns unique names", () => {
    expect(getUniqueMentions("@a @b @a")).toEqual(["a", "b"]);
  });
});

describe("countMentions", () => {
  it("counts occurrences", () => {
    const counts = countMentions("@alice @bob @alice");
    expect(counts.get("alice")).toBe(2);
    expect(counts.get("bob")).toBe(1);
  });
});

describe("highlightMentions", () => {
  it("wraps mentions with custom formatter", () => {
    const result = highlightMentions("hello @alice", (name) => `**@${name}**`);
    expect(result).toBe("hello **@alice**");
  });
});

describe("stripMentions", () => {
  it("removes mentions and collapses spaces", () => {
    expect(stripMentions("hello @alice how are you")).toBe("hello how are you");
  });

  it("handles multiple mentions", () => {
    expect(stripMentions("@a @b hello")).toBe("hello");
  });
});

describe("mentionsAgent", () => {
  it("returns true when agent is mentioned", () => {
    expect(mentionsAgent("hello @alice", "alice")).toBe(true);
  });

  it("returns false when agent is not mentioned", () => {
    expect(mentionsAgent("hello @bob", "alice")).toBe(false);
  });
});
