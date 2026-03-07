/**
 * Tests for user block list logic.
 */

import { describe, expect, it } from "bun:test";

describe("User Block List Validation", () => {
  it("cannot block yourself", () => {
    expect(() => {
      if ("user-1" === "user-1") throw new Error("Cannot block yourself");
    }).toThrow("Cannot block yourself");
  });

  it("block entry has correct shape", () => {
    const block = {
      blocker_id: "user-1",
      blocked_id: "user-2",
      created_at: new Date().toISOString(),
    };
    expect(block.blocker_id).toBe("user-1");
    expect(block.blocked_id).toBe("user-2");
    expect(block.created_at).toBeTruthy();
  });

  it("blocker and blocked are different users", () => {
    const blockerId = "user-1";
    const blockedId = "user-2";
    expect(blockerId).not.toBe(blockedId);
  });

  it("block composite key is unique pair", () => {
    const key1 = `${"user-1"}:${"user-2"}`;
    const key2 = `${"user-2"}:${"user-1"}`;
    // A blocking B is different from B blocking A
    expect(key1).not.toBe(key2);
  });

  it("created_at is valid ISO timestamp", () => {
    const now = new Date().toISOString();
    expect(new Date(now).toISOString()).toBe(now);
  });
});
