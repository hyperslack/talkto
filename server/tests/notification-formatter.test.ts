import { describe, it, expect } from "vitest";
import {
  notificationIcon,
  formatNotification,
  groupByChannel,
  countUnreadByType,
  formatDigest,
  mostRecent,
  filterByType,
  hasUnread,
  formatBadge,
  type Notification,
} from "../src/utils/notification-formatter";

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "mention",
    channelName: "general",
    senderName: "Alice",
    content: "Hello there",
    createdAt: "2025-01-01T00:00:00Z",
    isRead: false,
    ...overrides,
  };
}

describe("notificationIcon", () => {
  it("returns correct icons", () => {
    expect(notificationIcon("mention")).toBe("💬");
    expect(notificationIcon("reply")).toBe("↩️");
    expect(notificationIcon("reaction")).toBe("👍");
  });
});

describe("formatNotification", () => {
  it("formats unread notification", () => {
    const result = formatNotification(makeNotif());
    expect(result).toContain("●");
    expect(result).toContain("💬");
    expect(result).toContain("#general");
    expect(result).toContain("Alice");
  });

  it("formats read notification without dot", () => {
    const result = formatNotification(makeNotif({ isRead: true }));
    expect(result).not.toContain("●");
  });

  it("truncates long content", () => {
    const result = formatNotification(makeNotif({ content: "x".repeat(100) }));
    expect(result).toContain("...");
  });
});

describe("groupByChannel", () => {
  it("groups and sorts by unread count", () => {
    const notifs = [
      makeNotif({ channelName: "general", isRead: true }),
      makeNotif({ channelName: "random", isRead: false }),
      makeNotif({ channelName: "random", isRead: false }),
    ];
    const groups = groupByChannel(notifs);
    expect(groups).toHaveLength(2);
    expect(groups[0].channelName).toBe("random");
    expect(groups[0].unreadCount).toBe(2);
  });
});

describe("countUnreadByType", () => {
  it("counts unread by type", () => {
    const notifs = [
      makeNotif({ type: "mention", isRead: false }),
      makeNotif({ type: "mention", isRead: false }),
      makeNotif({ type: "reply", isRead: false }),
      makeNotif({ type: "mention", isRead: true }),
    ];
    const counts = countUnreadByType(notifs);
    expect(counts.get("mention")).toBe(2);
    expect(counts.get("reply")).toBe(1);
  });
});

describe("formatDigest", () => {
  it("formats a digest summary", () => {
    const notifs = [
      makeNotif({ channelName: "general", isRead: false }),
      makeNotif({ channelName: "general", isRead: false }),
      makeNotif({ channelName: "random", isRead: false }),
    ];
    const result = formatDigest(notifs);
    expect(result).toContain("3 unread notifications");
    expect(result).toContain("#general: 2 new");
    expect(result).toContain("#random: 1 new");
  });

  it("handles singular", () => {
    const result = formatDigest([makeNotif()]);
    expect(result).toContain("1 unread notification");
    expect(result).not.toContain("notifications");
  });
});

describe("mostRecent", () => {
  it("returns most recent notification", () => {
    const notifs = [
      makeNotif({ id: "a", createdAt: "2025-01-01T00:00:00Z" }),
      makeNotif({ id: "b", createdAt: "2025-01-02T00:00:00Z" }),
    ];
    expect(mostRecent(notifs)?.id).toBe("b");
  });

  it("returns null for empty", () => {
    expect(mostRecent([])).toBeNull();
  });
});

describe("filterByType", () => {
  it("filters correctly", () => {
    const notifs = [makeNotif({ type: "mention" }), makeNotif({ type: "reply" })];
    expect(filterByType(notifs, "mention")).toHaveLength(1);
  });
});

describe("hasUnread", () => {
  it("true when unread exist", () => {
    expect(hasUnread([makeNotif()])).toBe(true);
  });

  it("false when all read", () => {
    expect(hasUnread([makeNotif({ isRead: true })])).toBe(false);
  });
});

describe("formatBadge", () => {
  it("formats normal count", () => {
    expect(formatBadge(5)).toBe("5");
  });

  it("caps at 99+", () => {
    expect(formatBadge(100)).toBe("99+");
  });

  it("returns empty for zero", () => {
    expect(formatBadge(0)).toBe("");
  });
});
