/**
 * Tests for notification digest service.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  queueNotification,
  flushDigest,
  pendingCount,
  peekNotifications,
  flushAll,
  formatDigest,
  clearAll,
} from "../src/services/notification-digest";
import type { NotificationItem } from "../src/services/notification-digest";

const USER = "user-1";

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    type: "message",
    channelId: "ch-1",
    channelName: "general",
    fromUser: "alice",
    preview: "Hello world",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => clearAll());

describe("queueNotification / pendingCount", () => {
  it("queues notifications and counts them", () => {
    queueNotification(USER, makeItem());
    queueNotification(USER, makeItem());
    expect(pendingCount(USER)).toBe(2);
  });

  it("returns 0 for user with no notifications", () => {
    expect(pendingCount("nobody")).toBe(0);
  });
});

describe("peekNotifications", () => {
  it("returns copy of pending items without flushing", () => {
    queueNotification(USER, makeItem());
    const items = peekNotifications(USER);
    expect(items.length).toBe(1);
    expect(pendingCount(USER)).toBe(1); // still there
  });
});

describe("flushDigest", () => {
  it("generates digest and clears queue", () => {
    queueNotification(USER, makeItem({ channelName: "general" }));
    queueNotification(USER, makeItem({ channelName: "general" }));
    queueNotification(USER, makeItem({ channelName: "random" }));

    const digest = flushDigest(USER);
    expect(digest).not.toBeNull();
    expect(digest!.totalCount).toBe(3);
    expect(digest!.channelSummary.general).toBe(2);
    expect(digest!.channelSummary.random).toBe(1);
    expect(pendingCount(USER)).toBe(0);
  });

  it("returns null for empty queue", () => {
    expect(flushDigest(USER)).toBeNull();
  });
});

describe("flushAll", () => {
  it("flushes digests for all users", () => {
    queueNotification("u1", makeItem());
    queueNotification("u2", makeItem());
    const digests = flushAll();
    expect(digests.length).toBe(2);
  });
});

describe("formatDigest", () => {
  it("formats a readable summary", () => {
    queueNotification(USER, makeItem({ channelName: "general" }));
    queueNotification(USER, makeItem({ channelName: "random" }));
    const digest = flushDigest(USER)!;
    const text = formatDigest(digest);
    expect(text).toContain("2 new notifications");
    expect(text).toContain("#general");
    expect(text).toContain("#random");
  });
});
