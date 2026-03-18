import { describe, expect, test } from "bun:test";
import {
  batchByChannel,
  buildDigest,
  formatBatchLine,
  formatDigest,
  highPriority,
  hasMentions,
  NotificationAccumulator,
  type Notification,
} from "../src/utils/notification-batcher";

const now = Date.now();

const notifications: Notification[] = [
  { id: "1", channelId: "ch1", channelName: "general", senderId: "u1", senderName: "Alice", content: "hello", type: "message", timestamp: now - 5000 },
  { id: "2", channelId: "ch1", channelName: "general", senderId: "u2", senderName: "Bob", content: "hi @you", type: "mention", timestamp: now - 3000 },
  { id: "3", channelId: "ch2", channelName: "dev", senderId: "u1", senderName: "Alice", content: "fix pushed", type: "message", timestamp: now - 1000 },
  { id: "4", channelId: "ch1", channelName: "general", senderId: "u1", senderName: "Alice", content: "reply", type: "reply", timestamp: now },
];

describe("Notification Batcher", () => {
  test("batchByChannel groups by channel", () => {
    const batches = batchByChannel(notifications);
    expect(batches).toHaveLength(2);
  });

  test("batch has correct counts", () => {
    const batches = batchByChannel(notifications);
    const general = batches.find((b) => b.channelName === "general")!;
    expect(general.count).toBe(3);
    expect(general.senders).toContain("Alice");
    expect(general.senders).toContain("Bob");
  });

  test("batches sorted by newest first", () => {
    const batches = batchByChannel(notifications);
    expect(batches[0].channelName).toBe("general"); // has newest notification
  });

  test("buildDigest computes summary", () => {
    const digest = buildDigest(notifications);
    expect(digest.totalCount).toBe(4);
    expect(digest.channelCount).toBe(2);
    expect(digest.timeSpanMs).toBeGreaterThan(0);
  });

  test("buildDigest handles empty", () => {
    const digest = buildDigest([]);
    expect(digest.totalCount).toBe(0);
    expect(digest.channelCount).toBe(0);
  });

  test("formatBatchLine single sender", () => {
    const batch = batchByChannel([notifications[2]])[0];
    expect(formatBatchLine(batch)).toBe("#dev: 1 message from Alice");
  });

  test("formatBatchLine multiple senders", () => {
    const batch = batchByChannel(notifications).find((b) => b.channelName === "general")!;
    const line = formatBatchLine(batch);
    expect(line).toContain("#general");
    expect(line).toContain("3 messages");
    expect(line).toContain("1 other");
  });

  test("formatDigest full output", () => {
    const digest = buildDigest(notifications);
    const output = formatDigest(digest);
    expect(output).toContain("4 notifications in 2 channels");
    expect(output).toContain("#general");
  });

  test("formatDigest empty", () => {
    expect(formatDigest(buildDigest([]))).toBe("No new notifications");
  });

  test("highPriority filters to mentions and replies", () => {
    const hp = highPriority(notifications);
    expect(hp).toHaveLength(2);
    expect(hp.every((n) => n.type === "mention" || n.type === "reply")).toBe(true);
  });

  test("hasMentions detects mentions in batch", () => {
    const batches = batchByChannel(notifications);
    const general = batches.find((b) => b.channelName === "general")!;
    expect(hasMentions(general)).toBe(true);
  });
});

describe("NotificationAccumulator", () => {
  test("accumulates and flushes", () => {
    const acc = new NotificationAccumulator(100);
    acc.add(notifications[0]);
    acc.add(notifications[1]);
    expect(acc.pending()).toBe(2);
    const flushed = acc.flush();
    expect(flushed).toHaveLength(2);
    expect(acc.pending()).toBe(0);
  });

  test("shouldFlush respects window", () => {
    const acc = new NotificationAccumulator(999999);
    acc.add(notifications[0]);
    expect(acc.shouldFlush()).toBe(false);
  });
});
