import { describe, it, expect } from "bun:test";
import { TypingStateManager, formatTypingNames } from "../src/utils/typing-state-machine";

describe("TypingStateManager", () => {
  it("tracks typing users", () => {
    const mgr = new TypingStateManager();
    mgr.startTyping("ch1", "alice", "human");
    expect(mgr.getTypingNames("ch1")).toEqual(["alice"]);
  });

  it("stops typing removes entry", () => {
    const mgr = new TypingStateManager();
    mgr.startTyping("ch1", "alice", "human");
    mgr.stopTyping("ch1", "alice");
    expect(mgr.getTypingNames("ch1")).toEqual([]);
  });

  it("scopes by channel", () => {
    const mgr = new TypingStateManager();
    mgr.startTyping("ch1", "alice", "human");
    mgr.startTyping("ch2", "bob", "agent");
    expect(mgr.getTypingNames("ch1")).toEqual(["alice"]);
    expect(mgr.getTypingNames("ch2")).toEqual(["bob"]);
  });

  it("expires entries after timeout", () => {
    const mgr = new TypingStateManager(100); // 100ms timeout
    const now = Date.now();
    mgr.startTyping("ch1", "alice", "human");
    expect(mgr.getTyping("ch1", now).length).toBe(1);
    expect(mgr.getTyping("ch1", now + 200).length).toBe(0);
  });

  it("refreshes on re-type", () => {
    const mgr = new TypingStateManager(100);
    const now = Date.now();
    mgr.startTyping("ch1", "alice", "human");
    // Simulate re-typing which resets the timer
    mgr.startTyping("ch1", "alice", "human");
    expect(mgr.getTyping("ch1", now).length).toBe(1);
  });

  it("isAnyoneTyping works", () => {
    const mgr = new TypingStateManager();
    expect(mgr.isAnyoneTyping("ch1")).toBe(false);
    mgr.startTyping("ch1", "alice", "human");
    expect(mgr.isAnyoneTyping("ch1")).toBe(true);
  });

  it("formatTypingText returns formatted string", () => {
    const mgr = new TypingStateManager();
    mgr.startTyping("ch1", "alice", "human");
    expect(mgr.formatTypingText("ch1")).toBe("alice is typing…");
  });

  it("formatTypingText returns null when no one typing", () => {
    const mgr = new TypingStateManager();
    expect(mgr.formatTypingText("ch1")).toBeNull();
  });

  it("pruneExpired returns count", () => {
    const mgr = new TypingStateManager(100);
    mgr.startTyping("ch1", "alice", "human");
    mgr.startTyping("ch1", "bob", "agent");
    expect(mgr.pruneExpired(Date.now() + 200)).toBe(2);
  });

  it("clear removes everything", () => {
    const mgr = new TypingStateManager();
    mgr.startTyping("ch1", "alice", "human");
    mgr.clear();
    expect(mgr.size).toBe(0);
  });
});

describe("formatTypingNames", () => {
  it("returns null for empty", () => {
    expect(formatTypingNames([])).toBeNull();
  });

  it("formats single user", () => {
    expect(formatTypingNames(["alice"])).toBe("alice is typing…");
  });

  it("formats two users", () => {
    expect(formatTypingNames(["alice", "bob"])).toBe("alice and bob are typing…");
  });

  it("formats three users", () => {
    expect(formatTypingNames(["alice", "bob", "charlie"])).toBe("alice, bob, and charlie are typing…");
  });

  it("formats four+ users with count", () => {
    expect(formatTypingNames(["a", "b", "c", "d"])).toBe("a, b, and 2 others are typing…");
  });
});
