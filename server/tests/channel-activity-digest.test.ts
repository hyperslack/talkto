import { describe, expect, test } from "bun:test";
import {
  buildDigest,
  formatDigest,
  activityLevel,
  comparePeriods,
  type DigestMessage,
} from "../src/utils/channel-activity-digest";

function msg(overrides: Partial<DigestMessage> = {}): DigestMessage {
  return {
    senderName: overrides.senderName ?? "alice",
    senderType: overrides.senderType ?? "human",
    content: overrides.content ?? "hello world",
    createdAt: overrides.createdAt ?? "2025-01-15T10:00:00Z",
    hasThread: overrides.hasThread ?? false,
    isPinned: overrides.isPinned ?? false,
  };
}

describe("buildDigest", () => {
  test("builds basic digest from messages", () => {
    const messages = [
      msg({ senderName: "alice" }),
      msg({ senderName: "bob", senderType: "agent" }),
      msg({ senderName: "alice" }),
    ];
    const digest = buildDigest("general", messages);
    expect(digest.channelName).toBe("general");
    expect(digest.messageCount).toBe(3);
    expect(digest.uniqueSenders.length).toBe(2);
    expect(digest.humanMessages).toBe(2);
    expect(digest.agentMessages).toBe(1);
  });

  test("tracks pinned messages as highlights", () => {
    const messages = [
      msg({ isPinned: true, content: "important announcement" }),
      msg(),
    ];
    const digest = buildDigest("general", messages);
    expect(digest.pinnedCount).toBe(1);
    expect(digest.highlights.length).toBe(1);
    expect(digest.highlights[0]).toContain("important announcement");
  });

  test("counts threads", () => {
    const messages = [
      msg({ hasThread: true }),
      msg({ hasThread: true }),
      msg(),
    ];
    const digest = buildDigest("dev", messages);
    expect(digest.threadCount).toBe(2);
  });

  test("top senders sorted by count", () => {
    const messages = [
      msg({ senderName: "bob" }),
      msg({ senderName: "alice" }),
      msg({ senderName: "alice" }),
      msg({ senderName: "alice" }),
    ];
    const digest = buildDigest("dev", messages);
    expect(digest.topSenders[0].name).toBe("alice");
    expect(digest.topSenders[0].count).toBe(3);
  });

  test("handles empty messages", () => {
    const digest = buildDigest("empty", []);
    expect(digest.messageCount).toBe(0);
    expect(digest.uniqueSenders).toEqual([]);
  });
});

describe("formatDigest", () => {
  test("produces readable output", () => {
    const messages = [
      msg({ senderName: "alice" }),
      msg({ senderName: "bob", senderType: "agent" }),
    ];
    const digest = buildDigest("general", messages);
    const output = formatDigest(digest);
    expect(output).toContain("#general");
    expect(output).toContain("2 messages");
    expect(output).toContain("2 people");
    expect(output).toContain("👤 1 human");
    expect(output).toContain("🤖 1 agent");
  });

  test("includes highlights when present", () => {
    const messages = [msg({ isPinned: true, content: "check this" })];
    const digest = buildDigest("dev", messages);
    const output = formatDigest(digest);
    expect(output).toContain("Highlights");
    expect(output).toContain("check this");
  });
});

describe("activityLevel", () => {
  test("maps message counts to labels", () => {
    expect(activityLevel(0)).toBe("silent");
    expect(activityLevel(3)).toBe("quiet");
    expect(activityLevel(15)).toBe("moderate");
    expect(activityLevel(30)).toBe("active");
    expect(activityLevel(100)).toBe("very active");
  });
});

describe("comparePeriods", () => {
  test("detects upward trend", () => {
    const current = buildDigest("ch", [msg(), msg(), msg()]);
    const previous = buildDigest("ch", [msg()]);
    const delta = comparePeriods(current, previous);
    expect(delta.messageDelta).toBe(2);
    expect(delta.trend).toBe("up");
  });

  test("detects downward trend", () => {
    const current = buildDigest("ch", [msg()]);
    const previous = buildDigest("ch", [msg(), msg(), msg()]);
    const delta = comparePeriods(current, previous);
    expect(delta.trend).toBe("down");
  });

  test("detects flat trend", () => {
    const current = buildDigest("ch", [msg()]);
    const previous = buildDigest("ch", [msg()]);
    expect(comparePeriods(current, previous).trend).toBe("flat");
  });
});
