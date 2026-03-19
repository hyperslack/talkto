import { describe, it, expect } from "bun:test";
import { UnreadTracker } from "../src/utils/unread-state-tracker";

describe("UnreadTracker", () => {
  it("starts with zero unread", () => {
    const tracker = new UnreadTracker();
    tracker.initChannel("ch1");
    expect(tracker.getUnreadCount("ch1")).toBe(0);
    expect(tracker.hasUnread("ch1")).toBe(false);
  });

  it("increments on new message", () => {
    const tracker = new UnreadTracker();
    tracker.initChannel("ch1");
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    expect(tracker.getUnreadCount("ch1")).toBe(1);
    expect(tracker.hasUnread("ch1")).toBe(true);
  });

  it("does not count own messages", () => {
    const tracker = new UnreadTracker();
    tracker.initChannel("ch1");
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z", false, true);
    expect(tracker.getUnreadCount("ch1")).toBe(0);
  });

  it("tracks mentions", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z", true);
    const state = tracker.getState("ch1");
    expect(state?.hasMention).toBe(true);
  });

  it("markRead resets count", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch1", "2026-01-01T12:02:00Z");
    expect(tracker.getUnreadCount("ch1")).toBe(2);
    tracker.markRead("ch1");
    expect(tracker.getUnreadCount("ch1")).toBe(0);
    expect(tracker.getState("ch1")?.hasMention).toBe(false);
  });

  it("markAllRead resets all channels", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch2", "2026-01-01T12:01:00Z");
    tracker.markAllRead();
    expect(tracker.getTotalUnread()).toBe(0);
  });

  it("does not count messages before lastReadAt", () => {
    const tracker = new UnreadTracker();
    tracker.initChannel("ch1", "2026-01-01T12:00:00Z");
    tracker.onMessage("ch1", "2026-01-01T11:59:00Z"); // before lastRead
    expect(tracker.getUnreadCount("ch1")).toBe(0);
  });

  it("getTotalUnread sums across channels", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch2", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch2", "2026-01-01T12:02:00Z");
    expect(tracker.getTotalUnread()).toBe(3);
  });

  it("getUnreadChannels returns sorted", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch2", "2026-01-01T12:01:00Z");
    tracker.onMessage("ch2", "2026-01-01T12:02:00Z");
    const channels = tracker.getUnreadChannels();
    expect(channels[0].channelId).toBe("ch2");
    expect(channels[0].unreadCount).toBe(2);
  });

  it("getMentionChannels returns only mentions", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z", false);
    tracker.onMessage("ch2", "2026-01-01T12:01:00Z", true);
    const mentions = tracker.getMentionChannels();
    expect(mentions).toHaveLength(1);
    expect(mentions[0].channelId).toBe("ch2");
  });

  it("formatBadge returns null for 0, caps at 99+", () => {
    const tracker = new UnreadTracker();
    tracker.initChannel("ch1");
    expect(tracker.formatBadge("ch1")).toBeNull();

    for (let i = 0; i < 150; i++) {
      tracker.onMessage("ch1", `2026-01-01T12:${String(i).padStart(2, "0")}:00Z`);
    }
    expect(tracker.formatBadge("ch1")).toBe("99+");
  });

  it("removeChannel cleans up", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    tracker.removeChannel("ch1");
    expect(tracker.size).toBe(0);
  });

  it("auto-creates channel on message", () => {
    const tracker = new UnreadTracker();
    tracker.onMessage("ch1", "2026-01-01T12:01:00Z");
    expect(tracker.size).toBe(1);
  });
});
