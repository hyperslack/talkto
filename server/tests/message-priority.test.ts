/**
 * Tests for message priority service.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  setPriority,
  getPriority,
  clearPriority,
  isValidPriority,
  listByPriority,
  listAllPrioritized,
  priorityEmoji,
  priorityLabel,
  clearAll,
} from "../src/services/message-priority";

beforeEach(() => clearAll());

describe("setPriority / getPriority", () => {
  it("sets and retrieves priority", () => {
    setPriority("msg-1", "high", "user-1", "needs review");
    const p = getPriority("msg-1");
    expect(p).not.toBeNull();
    expect(p!.priority).toBe("high");
    expect(p!.reason).toBe("needs review");
  });

  it("overwrites existing priority", () => {
    setPriority("msg-1", "low", "user-1");
    setPriority("msg-1", "urgent", "user-2");
    expect(getPriority("msg-1")!.priority).toBe("urgent");
  });
});

describe("clearPriority", () => {
  it("removes priority", () => {
    setPriority("msg-1", "high", "user-1");
    expect(clearPriority("msg-1")).toBe(true);
    expect(getPriority("msg-1")).toBeNull();
  });

  it("returns false if not set", () => {
    expect(clearPriority("nope")).toBe(false);
  });
});

describe("isValidPriority", () => {
  it("validates known levels", () => {
    expect(isValidPriority("low")).toBe(true);
    expect(isValidPriority("medium")).toBe(true);
    expect(isValidPriority("high")).toBe(true);
    expect(isValidPriority("urgent")).toBe(true);
  });

  it("rejects unknown levels", () => {
    expect(isValidPriority("critical")).toBe(false);
    expect(isValidPriority("")).toBe(false);
  });
});

describe("listByPriority", () => {
  it("lists messages with a specific priority", () => {
    setPriority("msg-1", "high", "u1");
    setPriority("msg-2", "high", "u2");
    setPriority("msg-3", "low", "u1");
    expect(listByPriority("high").length).toBe(2);
  });
});

describe("listAllPrioritized", () => {
  it("sorts by urgency (highest first)", () => {
    setPriority("msg-1", "low", "u1");
    setPriority("msg-2", "urgent", "u1");
    setPriority("msg-3", "medium", "u1");
    const list = listAllPrioritized();
    expect(list[0].priority).toBe("urgent");
    expect(list[1].priority).toBe("medium");
    expect(list[2].priority).toBe("low");
  });
});

describe("priorityEmoji / priorityLabel", () => {
  it("returns correct emoji", () => {
    expect(priorityEmoji("urgent")).toBe("🔴");
    expect(priorityEmoji("low")).toBe("🟢");
  });

  it("returns capitalized label", () => {
    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel("urgent")).toBe("Urgent");
  });
});
