/**
 * Tests for Do-Not-Disturb manager.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  enableDnd,
  disableDnd,
  isDnd,
  getDndStatus,
  listDndUsers,
  remainingMinutes,
  clearAll,
} from "../src/services/dnd-manager";

const USER_A = "user-a";
const USER_B = "user-b";

beforeEach(() => clearAll());

describe("enableDnd / isDnd", () => {
  it("marks a user as DND", () => {
    enableDnd(USER_A, 60);
    expect(isDnd(USER_A)).toBe(true);
    expect(isDnd(USER_B)).toBe(false);
  });

  it("supports indefinite DND (durationMinutes=0)", () => {
    const entry = enableDnd(USER_A, 0);
    expect(entry.expiresAt).toBeNull();
    expect(isDnd(USER_A)).toBe(true);
  });

  it("auto-clears expired DND", () => {
    // Enable with duration in the past by manipulating entry directly
    enableDnd(USER_A, 60);
    // Manually expire it
    const entry = getDndStatus(USER_A)!;
    (entry as any).expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(isDnd(USER_A)).toBe(false);
  });
});

describe("disableDnd", () => {
  it("removes DND status", () => {
    enableDnd(USER_A, 60);
    expect(disableDnd(USER_A)).toBe(true);
    expect(isDnd(USER_A)).toBe(false);
  });

  it("returns false if user was not in DND", () => {
    expect(disableDnd(USER_A)).toBe(false);
  });
});

describe("getDndStatus", () => {
  it("returns entry for active DND user", () => {
    enableDnd(USER_A, 30);
    const status = getDndStatus(USER_A);
    expect(status).not.toBeNull();
    expect(status!.userId).toBe(USER_A);
    expect(status!.expiresAt).toBeTruthy();
  });

  it("returns null for non-DND user", () => {
    expect(getDndStatus(USER_A)).toBeNull();
  });
});

describe("listDndUsers", () => {
  it("lists all active DND users", () => {
    enableDnd(USER_A, 60);
    enableDnd(USER_B, 0);
    const list = listDndUsers();
    expect(list.length).toBe(2);
  });
});

describe("remainingMinutes", () => {
  it("returns -1 for non-DND user", () => {
    expect(remainingMinutes(USER_A)).toBe(-1);
  });

  it("returns 0 for indefinite DND", () => {
    enableDnd(USER_A, 0);
    expect(remainingMinutes(USER_A)).toBe(0);
  });

  it("returns positive minutes for timed DND", () => {
    enableDnd(USER_A, 120);
    const mins = remainingMinutes(USER_A);
    expect(mins).toBeGreaterThan(0);
    expect(mins).toBeLessThanOrEqual(120);
  });
});
