import { describe, it, expect } from "bun:test";
import { computeUnread, formatBadgeCount } from "./unread-utils";

const me = "user-1";
const messages = [
  { created_at: "2026-03-10T01:00:00Z", sender_id: "user-1" },
  { created_at: "2026-03-10T02:00:00Z", sender_id: "user-2" },
  { created_at: "2026-03-10T03:00:00Z", sender_id: "user-2" },
  { created_at: "2026-03-10T04:00:00Z", sender_id: "user-3" },
];

describe("computeUnread", () => {
  it("counts all non-self messages when never read", () => {
    const info = computeUnread(messages, null, me);
    expect(info.count).toBe(3);
    expect(info.hasUnread).toBe(true);
  });

  it("counts messages after lastReadAt", () => {
    const info = computeUnread(messages, "2026-03-10T02:30:00Z", me);
    expect(info.count).toBe(2); // 03:00 and 04:00
  });

  it("returns zero when all read", () => {
    const info = computeUnread(messages, "2026-03-10T05:00:00Z", me);
    expect(info.count).toBe(0);
    expect(info.hasUnread).toBe(false);
  });

  it("excludes own messages from unread", () => {
    const msgs = [
      { created_at: "2026-03-10T05:00:00Z", sender_id: me },
    ];
    const info = computeUnread(msgs, "2026-03-10T04:00:00Z", me);
    expect(info.count).toBe(0);
  });

  it("formats badge as 99+ for large counts", () => {
    const manyMsgs = Array.from({ length: 150 }, (_, i) => ({
      created_at: `2026-03-10T${String(i).padStart(2, "0")}:00:00Z`,
      sender_id: "other",
    }));
    const info = computeUnread(manyMsgs, null, me);
    expect(info.badge).toBe("99+");
  });
});

describe("formatBadgeCount", () => {
  it("returns empty for zero", () => {
    expect(formatBadgeCount(0)).toBe("");
  });

  it("returns number as string", () => {
    expect(formatBadgeCount(5)).toBe("5");
  });

  it("caps at 99+", () => {
    expect(formatBadgeCount(100)).toBe("99+");
  });
});
