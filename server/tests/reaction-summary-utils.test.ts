import { describe, it, expect } from "vitest";
import {
  summarizeMessage,
  rankEmojis,
  topReactedMessages,
  formatCompact,
  mostPopularEmoji,
  uniqueReactorCount,
  type ReactionData,
} from "../src/utils/reaction-summary";

const reactions: ReactionData[] = [
  { messageId: "m1", emoji: "👍", userId: "u1", userName: "Alice" },
  { messageId: "m1", emoji: "👍", userId: "u2", userName: "Bob" },
  { messageId: "m1", emoji: "🔥", userId: "u1", userName: "Alice" },
  { messageId: "m2", emoji: "👍", userId: "u3", userName: "Carol" },
  { messageId: "m2", emoji: "❤️", userId: "u1", userName: "Alice" },
];

describe("summarizeMessage", () => {
  it("summarizes reactions for a message", () => {
    const m1 = reactions.filter((r) => r.messageId === "m1");
    const summary = summarizeMessage(m1);
    expect(summary.messageId).toBe("m1");
    expect(summary.totalReactions).toBe(3);
    expect(summary.uniqueReactors).toBe(2);
    expect(summary.emojis[0].emoji).toBe("👍");
    expect(summary.emojis[0].count).toBe(2);
  });

  it("handles empty input", () => {
    const summary = summarizeMessage([]);
    expect(summary.totalReactions).toBe(0);
    expect(summary.uniqueReactors).toBe(0);
  });
});

describe("rankEmojis", () => {
  it("ranks by unique user count", () => {
    const ranked = rankEmojis(reactions);
    expect(ranked[0].emoji).toBe("👍");
    expect(ranked[0].count).toBe(3); // 3 unique users used 👍
  });
});

describe("topReactedMessages", () => {
  it("returns messages sorted by reaction count", () => {
    const top = topReactedMessages(reactions, 2);
    expect(top[0].messageId).toBe("m1");
    expect(top[0].count).toBe(3);
    expect(top[1].messageId).toBe("m2");
  });

  it("respects limit", () => {
    expect(topReactedMessages(reactions, 1)).toHaveLength(1);
  });
});

describe("formatCompact", () => {
  it("formats reaction summary", () => {
    const m1 = reactions.filter((r) => r.messageId === "m1");
    const summary = summarizeMessage(m1);
    const result = formatCompact(summary);
    expect(result).toContain("👍 2");
    expect(result).toContain("🔥 1");
  });
});

describe("mostPopularEmoji", () => {
  it("returns the most used emoji", () => {
    expect(mostPopularEmoji(reactions)).toBe("👍");
  });

  it("returns null for empty", () => {
    expect(mostPopularEmoji([])).toBeNull();
  });
});

describe("uniqueReactorCount", () => {
  it("counts unique users", () => {
    expect(uniqueReactorCount(reactions)).toBe(3);
  });
});
