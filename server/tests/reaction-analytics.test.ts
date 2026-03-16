import { describe, test, expect } from "bun:test";
import {
  computeEmojiRankings,
  buildUserProfile,
  buildChannelSummary,
  findTrendingEmojis,
  diversityScore,
  type ReactionData,
} from "../src/lib/reaction-analytics";

const now = new Date().toISOString();

function makeReaction(emoji: string, userId: string = "u1", messageId: string = "m1", channelId: string = "ch1"): ReactionData {
  return { emoji, userId, messageId, channelId, createdAt: now };
}

describe("computeEmojiRankings", () => {
  test("ranks emojis by frequency", () => {
    const reactions = [makeReaction("👍"), makeReaction("👍"), makeReaction("👍"), makeReaction("❤️"), makeReaction("😂")];
    const rankings = computeEmojiRankings(reactions);
    expect(rankings[0].emoji).toBe("👍");
    expect(rankings[0].count).toBe(3);
    expect(rankings[0].percentage).toBe(60);
  });

  test("respects limit", () => {
    const reactions = [makeReaction("a"), makeReaction("b"), makeReaction("c")];
    expect(computeEmojiRankings(reactions, 2)).toHaveLength(2);
  });

  test("handles empty input", () => {
    expect(computeEmojiRankings([])).toHaveLength(0);
  });
});

describe("buildUserProfile", () => {
  test("builds profile from given and received reactions", () => {
    const given = [makeReaction("👍"), makeReaction("❤️"), makeReaction("👍")];
    const received = [makeReaction("🔥"), makeReaction("😂")];
    const profile = buildUserProfile("u1", given, received);

    expect(profile.reactionsGiven).toBe(3);
    expect(profile.reactionsReceived).toBe(2);
    expect(profile.totalReactions).toBe(5);
    expect(profile.uniqueEmojis).toBe(2);
    expect(profile.favoriteEmoji).toBe("👍");
  });

  test("handles user with no reactions", () => {
    const profile = buildUserProfile("u1", [], []);
    expect(profile.totalReactions).toBe(0);
    expect(profile.favoriteEmoji).toBeNull();
  });
});

describe("buildChannelSummary", () => {
  test("builds channel summary", () => {
    const reactions = [
      makeReaction("👍", "u1", "m1", "ch1"),
      makeReaction("👍", "u2", "m1", "ch1"),
      makeReaction("❤️", "u1", "m2", "ch1"),
    ];
    const summary = buildChannelSummary("ch1", reactions, 10);

    expect(summary.totalReactions).toBe(3);
    expect(summary.uniqueEmojis).toBe(2);
    expect(summary.mostReactedMessageId).toBe("m1");
    expect(summary.avgReactionsPerMessage).toBe(0.3);
  });

  test("filters by channelId", () => {
    const reactions = [
      makeReaction("👍", "u1", "m1", "ch1"),
      makeReaction("❤️", "u1", "m2", "ch2"),
    ];
    const summary = buildChannelSummary("ch1", reactions, 5);
    expect(summary.totalReactions).toBe(1);
  });

  test("handles empty channel", () => {
    const summary = buildChannelSummary("ch1", [], 0);
    expect(summary.totalReactions).toBe(0);
    expect(summary.mostReactedMessageId).toBeNull();
  });
});

describe("findTrendingEmojis", () => {
  test("finds growing emojis", () => {
    const recent = [makeReaction("🔥"), makeReaction("🔥"), makeReaction("🔥")];
    const previous = [makeReaction("🔥")];
    const trending = findTrendingEmojis(recent, previous);

    expect(trending).toHaveLength(1);
    expect(trending[0].emoji).toBe("🔥");
    expect(trending[0].growth).toBe(200);
  });

  test("identifies new emojis as trending", () => {
    const recent = [makeReaction("✨")];
    const previous: ReactionData[] = [];
    const trending = findTrendingEmojis(recent, previous);
    expect(trending.some((t) => t.emoji === "✨")).toBe(true);
  });

  test("excludes declining emojis", () => {
    const recent = [makeReaction("👍")];
    const previous = [makeReaction("👍"), makeReaction("👍"), makeReaction("👍")];
    const trending = findTrendingEmojis(recent, previous);
    expect(trending.length).toBe(0);
  });
});

describe("diversityScore", () => {
  test("returns 0 for empty", () => {
    expect(diversityScore([])).toBe(0);
  });

  test("returns high score for diverse reactions", () => {
    const reactions = [makeReaction("👍"), makeReaction("❤️"), makeReaction("🔥"), makeReaction("😂")];
    expect(diversityScore(reactions)).toBeGreaterThan(50);
  });

  test("returns lower score for repetitive reactions", () => {
    const reactions = Array(10).fill(null).map(() => makeReaction("👍"));
    expect(diversityScore(reactions)).toBeLessThanOrEqual(20);
  });
});
