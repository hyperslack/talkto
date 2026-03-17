import { describe, it, expect } from "vitest";
import {
  flattenThreads,
  buildThreadTrees,
  getRoots,
  countReplies,
  maxThreadDepth,
  formatIndented,
  buildChildMap,
  type ThreadMessage,
} from "../src/utils/thread-flattening";

const msgs: ThreadMessage[] = [
  { id: "1", parentId: null, senderId: "u1", senderName: "Alice", content: "Hello", createdAt: "2025-01-01T00:00:00Z" },
  { id: "2", parentId: "1", senderId: "u2", senderName: "Bob", content: "Hi!", createdAt: "2025-01-01T00:01:00Z" },
  { id: "3", parentId: "1", senderId: "u3", senderName: "Carol", content: "Hey", createdAt: "2025-01-01T00:02:00Z" },
  { id: "4", parentId: "2", senderId: "u1", senderName: "Alice", content: "How are you?", createdAt: "2025-01-01T00:03:00Z" },
  { id: "5", parentId: null, senderId: "u2", senderName: "Bob", content: "New topic", createdAt: "2025-01-01T00:04:00Z" },
];

describe("buildChildMap", () => {
  it("maps parentId to children", () => {
    const map = buildChildMap(msgs);
    expect(map.get("1")).toHaveLength(2);
    expect(map.get("2")).toHaveLength(1);
    expect(map.has("5")).toBe(false);
  });
});

describe("flattenThreads", () => {
  it("produces correct flat order with depths", () => {
    const flat = flattenThreads(msgs);
    expect(flat).toHaveLength(5);
    expect(flat[0]).toMatchObject({ id: "1", depth: 0, isRoot: true });
    expect(flat[1]).toMatchObject({ id: "2", depth: 1, isRoot: false });
    expect(flat[2]).toMatchObject({ id: "4", depth: 2, threadRootId: "1" });
    expect(flat[3]).toMatchObject({ id: "3", depth: 1 });
    expect(flat[4]).toMatchObject({ id: "5", depth: 0, isRoot: true });
  });

  it("handles empty input", () => {
    expect(flattenThreads([])).toHaveLength(0);
  });

  it("handles flat messages (no threads)", () => {
    const flat = flattenThreads([msgs[0], msgs[4]]);
    expect(flat).toHaveLength(2);
    expect(flat.every((m) => m.depth === 0)).toBe(true);
  });
});

describe("buildThreadTrees", () => {
  it("builds correct trees", () => {
    const trees = buildThreadTrees(msgs);
    expect(trees).toHaveLength(2);
    expect(trees[0].root.id).toBe("1");
    expect(trees[0].replies).toHaveLength(3);
    expect(trees[0].depth).toBe(2);
    expect(trees[0].participantIds.size).toBe(3);
    expect(trees[1].root.id).toBe("5");
    expect(trees[1].replies).toHaveLength(0);
  });

  it("tracks lastReplyAt", () => {
    const trees = buildThreadTrees(msgs);
    expect(trees[0].lastReplyAt).toBe("2025-01-01T00:03:00Z");
    expect(trees[1].lastReplyAt).toBeNull();
  });
});

describe("getRoots", () => {
  it("returns only root messages", () => {
    const roots = getRoots(msgs);
    expect(roots).toHaveLength(2);
    expect(roots.map((r) => r.id)).toEqual(["1", "5"]);
  });
});

describe("countReplies", () => {
  it("counts non-root messages", () => {
    expect(countReplies(msgs)).toBe(3);
  });

  it("returns 0 for no replies", () => {
    expect(countReplies([msgs[0]])).toBe(0);
  });
});

describe("maxThreadDepth", () => {
  it("finds deepest nesting", () => {
    expect(maxThreadDepth(msgs)).toBe(2);
  });

  it("returns 0 for flat messages", () => {
    expect(maxThreadDepth([msgs[0], msgs[4]])).toBe(0);
  });
});

describe("formatIndented", () => {
  it("indents based on depth", () => {
    const flat = flattenThreads(msgs);
    expect(formatIndented(flat[0])).toBe("[Alice]: Hello");
    expect(formatIndented(flat[1])).toBe("  [Bob]: Hi!");
    expect(formatIndented(flat[2])).toBe("    [Alice]: How are you?");
  });

  it("supports custom indent", () => {
    const flat = flattenThreads(msgs);
    expect(formatIndented(flat[1], "→ ")).toBe("→ [Bob]: Hi!");
  });
});
