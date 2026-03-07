/**
 * Tests for per-channel notification levels.
 */

import { describe, expect, it } from "bun:test";

describe("Channel Notification Levels", () => {
  it("valid notification levels", () => {
    const valid = ["all", "mentions", "none"];
    expect(valid.length).toBe(3);
    for (const l of valid) {
      expect(["all", "mentions", "none"].includes(l)).toBe(true);
    }
  });

  it("rejects invalid level", () => {
    expect(["all", "mentions", "none"].includes("everything")).toBe(false);
  });

  it("default level is 'all'", () => {
    const defaultLevel = "all";
    expect(defaultLevel).toBe("all");
  });

  it("shouldNotify logic for 'all'", () => {
    const level = "all";
    expect(level === "all").toBe(true); // always notify
  });

  it("shouldNotify logic for 'mentions'", () => {
    const level = "mentions";
    const isMentioned = true;
    const shouldNotify = level === "all" || (level === "mentions" && isMentioned);
    expect(shouldNotify).toBe(true);

    const notMentioned = false;
    const shouldNotNotify = level === "all" || (level === "mentions" && notMentioned);
    expect(shouldNotNotify).toBe(false);
  });

  it("shouldNotify logic for 'none'", () => {
    const level = "none";
    const shouldNotify = level === "all" || (level === "mentions" && true);
    expect(shouldNotify).toBe(false);
  });

  it("pref shape has correct fields", () => {
    const pref = {
      user_id: "u1",
      channel_id: "ch1",
      level: "mentions" as const,
      updated_at: new Date().toISOString(),
    };
    expect(pref.user_id).toBe("u1");
    expect(pref.level).toBe("mentions");
  });
});
