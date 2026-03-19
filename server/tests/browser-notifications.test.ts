import { describe, it, expect } from "bun:test";
import {
  shouldNotify,
  buildNotificationPayload,
  isMentioned,
  buildDocumentTitle,
  defaultContext,
} from "../src/utils/browser-notifications";

const baseMessage = {
  id: "msg-1",
  channel_id: "ch-1",
  channel_name: "general",
  sender_name: "alice",
  sender_type: "human" as const,
  content: "Hello world",
  mentions: [],
};

describe("shouldNotify", () => {
  it("returns false when notifications disabled", () => {
    const ctx = { ...defaultContext(), enabled: false };
    expect(shouldNotify(baseMessage, ctx)).toBe(false);
  });

  it("returns false for muted channels", () => {
    const ctx = { ...defaultContext(), isFocused: false, mutedChannels: new Set(["ch-1"]) };
    expect(shouldNotify(baseMessage, ctx)).toBe(false);
  });

  it("returns false when focused on the active channel", () => {
    const ctx = { ...defaultContext(), isFocused: true, isActiveChannel: true };
    expect(shouldNotify(baseMessage, ctx)).toBe(false);
  });

  it("returns true when not focused", () => {
    const ctx = { ...defaultContext(), isFocused: false };
    expect(shouldNotify(baseMessage, ctx)).toBe(true);
  });

  it("returns true when focused on different channel", () => {
    const ctx = { ...defaultContext(), isFocused: true, isActiveChannel: false };
    expect(shouldNotify(baseMessage, ctx)).toBe(true);
  });

  it("always notifies on direct mention even when focused", () => {
    const ctx = { ...defaultContext(), isFocused: true, isActiveChannel: false };
    const msg = { ...baseMessage, mentions: ["bob"] };
    expect(shouldNotify(msg, ctx, "bob")).toBe(true);
  });
});

describe("buildNotificationPayload", () => {
  it("builds correct payload for human message", () => {
    const payload = buildNotificationPayload(baseMessage);
    expect(payload.title).toBe("alice in #general");
    expect(payload.body).toBe("Hello world");
    expect(payload.tag).toContain("talkto-ch-1");
  });

  it("adds robot emoji for agent messages", () => {
    const msg = { ...baseMessage, sender_type: "agent" as const, sender_name: "claude" };
    const payload = buildNotificationPayload(msg);
    expect(payload.title).toContain("🤖 claude");
  });

  it("truncates long content", () => {
    const msg = { ...baseMessage, content: "a".repeat(200) };
    const payload = buildNotificationPayload(msg);
    expect(payload.body.length).toBeLessThanOrEqual(100);
    expect(payload.body).toEndWith("…");
  });

  it("collapses newlines in body", () => {
    const msg = { ...baseMessage, content: "line1\n\nline2\nline3" };
    const payload = buildNotificationPayload(msg);
    expect(payload.body).toBe("line1 line2 line3");
  });
});

describe("isMentioned", () => {
  it("returns true when user is in mentions", () => {
    expect(isMentioned({ ...baseMessage, mentions: ["bob", "alice"] }, "bob")).toBe(true);
  });

  it("returns false when not mentioned", () => {
    expect(isMentioned(baseMessage, "bob")).toBe(false);
  });

  it("returns false for empty mentions", () => {
    expect(isMentioned({ ...baseMessage, mentions: [] }, "bob")).toBe(false);
  });
});

describe("buildDocumentTitle", () => {
  it("returns base name for 0 unread", () => {
    expect(buildDocumentTitle(0)).toBe("TalkTo");
  });

  it("returns count prefix for unread messages", () => {
    expect(buildDocumentTitle(5)).toBe("(5) TalkTo");
  });

  it("caps at 99+", () => {
    expect(buildDocumentTitle(150)).toBe("(99+) TalkTo");
  });

  it("accepts custom base name", () => {
    expect(buildDocumentTitle(3, "MyApp")).toBe("(3) MyApp");
  });
});
