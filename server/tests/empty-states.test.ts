import { describe, it, expect } from "bun:test";
import {
  getEmptyState,
  getAvailableKinds,
  formatEmptyState,
  getChannelEmptyState,
  isValidEmptyStateKind,
} from "../src/utils/empty-states";

describe("getEmptyState", () => {
  it("returns content for no_messages", () => {
    const state = getEmptyState("no_messages");
    expect(state.emoji).toBe("💬");
    expect(state.title).toBe("No messages yet");
    expect(state.description).toBeTruthy();
    expect(state.actionHint).toBeTruthy();
  });

  it("returns content for no_notifications without actionHint", () => {
    const state = getEmptyState("no_notifications");
    expect(state.emoji).toBe("🔔");
    expect(state.title).toBe("All caught up!");
    expect(state.actionHint).toBeUndefined();
  });

  it("returns content for all kinds", () => {
    for (const kind of getAvailableKinds()) {
      const state = getEmptyState(kind);
      expect(state.emoji).toBeTruthy();
      expect(state.title).toBeTruthy();
      expect(state.description).toBeTruthy();
    }
  });
});

describe("getAvailableKinds", () => {
  it("returns all 11 kinds", () => {
    const kinds = getAvailableKinds();
    expect(kinds).toHaveLength(11);
    expect(kinds).toContain("no_messages");
    expect(kinds).toContain("no_agents");
    expect(kinds).toContain("channel_archived");
  });
});

describe("formatEmptyState", () => {
  it("formats as single-line string with emoji", () => {
    const result = formatEmptyState("no_messages");
    expect(result).toContain("💬");
    expect(result).toContain("No messages yet");
    expect(result).toContain("—");
  });
});

describe("getChannelEmptyState", () => {
  it("returns archived state for archived channels", () => {
    const state = getChannelEmptyState({ is_archived: true });
    expect(state.title).toBe("Channel archived");
  });

  it("returns no_messages for active channels", () => {
    const state = getChannelEmptyState({ is_archived: false });
    expect(state.title).toBe("No messages yet");
  });

  it("returns no_messages when is_archived is undefined", () => {
    const state = getChannelEmptyState({});
    expect(state.title).toBe("No messages yet");
  });
});

describe("isValidEmptyStateKind", () => {
  it("returns true for valid kinds", () => {
    expect(isValidEmptyStateKind("no_messages")).toBe(true);
    expect(isValidEmptyStateKind("no_agents")).toBe(true);
  });

  it("returns false for invalid kinds", () => {
    expect(isValidEmptyStateKind("invalid")).toBe(false);
    expect(isValidEmptyStateKind("")).toBe(false);
  });
});
