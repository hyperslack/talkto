/**
 * Tests for thread auto-close service.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  setAutoCloseConfig,
  getAutoCloseConfig,
  removeAutoCloseConfig,
  updateThreadActivity,
  closeThread,
  closeInactiveThreads,
  getThreadStatus,
  listOpenThreads,
  clearAll,
} from "../src/services/thread-auto-close";

beforeEach(() => clearAll());

describe("setAutoCloseConfig / getAutoCloseConfig", () => {
  it("sets and retrieves config", () => {
    setAutoCloseConfig("ch-1", 60);
    const config = getAutoCloseConfig("ch-1");
    expect(config).not.toBeNull();
    expect(config!.inactivityMinutes).toBe(60);
    expect(config!.enabled).toBe(true);
  });

  it("returns null for unconfigured channel", () => {
    expect(getAutoCloseConfig("ch-none")).toBeNull();
  });
});

describe("removeAutoCloseConfig", () => {
  it("removes config", () => {
    setAutoCloseConfig("ch-1", 30);
    expect(removeAutoCloseConfig("ch-1")).toBe(true);
    expect(getAutoCloseConfig("ch-1")).toBeNull();
  });
});

describe("updateThreadActivity", () => {
  it("registers a new thread", () => {
    const t = updateThreadActivity("msg-1", "ch-1");
    expect(t.messageId).toBe("msg-1");
    expect(t.isClosed).toBe(false);
  });

  it("updates existing thread activity", () => {
    updateThreadActivity("msg-1", "ch-1");
    const t = updateThreadActivity("msg-1", "ch-1");
    expect(t.isClosed).toBe(false);
  });

  it("re-opens a closed thread on new activity", () => {
    updateThreadActivity("msg-1", "ch-1");
    closeThread("msg-1");
    const t = updateThreadActivity("msg-1", "ch-1");
    expect(t.isClosed).toBe(false);
  });
});

describe("closeThread", () => {
  it("manually closes a thread", () => {
    updateThreadActivity("msg-1", "ch-1");
    expect(closeThread("msg-1")).toBe(true);
    const t = getThreadStatus("msg-1");
    expect(t!.isClosed).toBe(true);
    expect(t!.closedReason).toBe("manual");
  });

  it("returns false for already closed thread", () => {
    updateThreadActivity("msg-1", "ch-1");
    closeThread("msg-1");
    expect(closeThread("msg-1")).toBe(false);
  });
});

describe("closeInactiveThreads", () => {
  it("closes threads past inactivity threshold", () => {
    setAutoCloseConfig("ch-1", 0); // 0 minutes = close immediately
    const t = updateThreadActivity("msg-1", "ch-1");
    // Backdate the activity
    (t as any).lastActivityAt = new Date(Date.now() - 60_000).toISOString();

    const closed = closeInactiveThreads();
    expect(closed.length).toBe(1);
    expect(closed[0].closedReason).toBe("inactivity");
  });

  it("skips channels without config", () => {
    updateThreadActivity("msg-1", "ch-no-config");
    const closed = closeInactiveThreads();
    expect(closed.length).toBe(0);
  });
});

describe("listOpenThreads", () => {
  it("lists only open threads", () => {
    updateThreadActivity("msg-1", "ch-1");
    updateThreadActivity("msg-2", "ch-1");
    closeThread("msg-1");
    expect(listOpenThreads("ch-1").length).toBe(1);
  });
});
