import { describe, expect, test } from "bun:test";
import {
  byContent,
  bySender,
  bySenderType,
  byDateRange,
  isThreadRoot,
  isPinned,
  hasCode,
  hasMentions,
  composeFilters,
  filterMessages,
  searchMessages,
  countOccurrences,
  type MessageLike,
} from "../src/utils/message-search-filter";

function msg(overrides: Partial<MessageLike> = {}): MessageLike {
  return {
    id: overrides.id ?? "m1",
    content: overrides.content ?? "hello world",
    sender_name: overrides.sender_name ?? "alice",
    sender_type: overrides.sender_type ?? "human",
    created_at: overrides.created_at ?? "2025-01-15T10:00:00Z",
    parent_id: overrides.parent_id ?? null,
    is_pinned: overrides.is_pinned ?? false,
  };
}

describe("byContent", () => {
  test("matches case-insensitively", () => {
    const filter = byContent("HELLO");
    expect(filter(msg({ content: "Hello World" }))).toBe(true);
  });

  test("no match returns false", () => {
    expect(byContent("xyz")(msg())).toBe(false);
  });
});

describe("bySender", () => {
  test("matches sender name case-insensitively", () => {
    expect(bySender("Alice")(msg({ sender_name: "alice" }))).toBe(true);
  });

  test("no match for different sender", () => {
    expect(bySender("bob")(msg({ sender_name: "alice" }))).toBe(false);
  });
});

describe("bySenderType", () => {
  test("matches human", () => {
    expect(bySenderType("human")(msg({ sender_type: "human" }))).toBe(true);
    expect(bySenderType("agent")(msg({ sender_type: "human" }))).toBe(false);
  });
});

describe("byDateRange", () => {
  test("filters by after", () => {
    const filter = byDateRange("2025-01-15T11:00:00Z");
    expect(filter(msg({ created_at: "2025-01-15T10:00:00Z" }))).toBe(false);
    expect(filter(msg({ created_at: "2025-01-15T12:00:00Z" }))).toBe(true);
  });

  test("filters by before", () => {
    const filter = byDateRange(undefined, "2025-01-15T09:00:00Z");
    expect(filter(msg({ created_at: "2025-01-15T10:00:00Z" }))).toBe(false);
  });

  test("both bounds", () => {
    const filter = byDateRange("2025-01-15T09:00:00Z", "2025-01-15T11:00:00Z");
    expect(filter(msg({ created_at: "2025-01-15T10:00:00Z" }))).toBe(true);
  });
});

describe("isThreadRoot", () => {
  test("matches messages without parent", () => {
    expect(isThreadRoot()(msg({ parent_id: null }))).toBe(true);
    expect(isThreadRoot()(msg({ parent_id: "p1" }))).toBe(false);
  });
});

describe("isPinned", () => {
  test("matches pinned messages", () => {
    expect(isPinned()(msg({ is_pinned: true }))).toBe(true);
    expect(isPinned()(msg({ is_pinned: false }))).toBe(false);
  });
});

describe("hasCode", () => {
  test("matches fenced code blocks", () => {
    expect(hasCode()(msg({ content: "```js\ncode\n```" }))).toBe(true);
  });

  test("matches inline code", () => {
    expect(hasCode()(msg({ content: "use `npm install`" }))).toBe(true);
  });

  test("no match for plain text", () => {
    expect(hasCode()(msg({ content: "plain text" }))).toBe(false);
  });
});

describe("hasMentions", () => {
  test("matches @mentions", () => {
    expect(hasMentions()(msg({ content: "hey @alice" }))).toBe(true);
  });

  test("no match without mentions", () => {
    expect(hasMentions()(msg({ content: "hello world" }))).toBe(false);
  });
});

describe("composeFilters", () => {
  test("composes with AND logic", () => {
    const filter = composeFilters(bySenderType("human"), byContent("hello"));
    expect(filter(msg({ sender_type: "human", content: "hello" }))).toBe(true);
    expect(filter(msg({ sender_type: "agent", content: "hello" }))).toBe(false);
  });
});

describe("filterMessages", () => {
  test("applies filters to array", () => {
    const messages = [
      msg({ id: "m1", content: "hello", sender_type: "human" }),
      msg({ id: "m2", content: "hello", sender_type: "agent" }),
      msg({ id: "m3", content: "goodbye", sender_type: "human" }),
    ];
    const result = filterMessages(messages, byContent("hello"), bySenderType("human"));
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("m1");
  });
});

describe("searchMessages", () => {
  test("returns matching results with total", () => {
    const messages = [
      msg({ content: "hello world" }),
      msg({ content: "goodbye world" }),
      msg({ content: "hello again" }),
    ];
    const { results, total } = searchMessages(messages, "hello");
    expect(total).toBe(2);
    expect(results.length).toBe(2);
  });
});

describe("countOccurrences", () => {
  test("counts all occurrences across messages", () => {
    const messages = [
      msg({ content: "hello hello" }),
      msg({ content: "hello world" }),
    ];
    expect(countOccurrences(messages, "hello")).toBe(3);
  });

  test("zero for no matches", () => {
    expect(countOccurrences([msg()], "xyz")).toBe(0);
  });
});
