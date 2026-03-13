import { describe, it, expect } from "bun:test";
import {
  computeDepth,
  resolveParent,
  buildThreadMap,
  getThreadRoot,
  threadSize,
  DEFAULT_MAX_DEPTH,
} from "../src/lib/thread-depth";

function makeChain(length: number) {
  const msgs = [];
  for (let i = 0; i < length; i++) {
    msgs.push({ id: `m${i}`, parentId: i === 0 ? null : `m${i - 1}` });
  }
  return buildThreadMap(msgs);
}

describe("computeDepth", () => {
  it("returns 0 for root messages", () => {
    const map = buildThreadMap([{ id: "m0", parentId: null }]);
    expect(computeDepth("m0", map)).toBe(0);
  });

  it("returns correct depth for nested messages", () => {
    const map = makeChain(4);
    expect(computeDepth("m0", map)).toBe(0);
    expect(computeDepth("m1", map)).toBe(1);
    expect(computeDepth("m2", map)).toBe(2);
    expect(computeDepth("m3", map)).toBe(3);
  });

  it("handles missing parent gracefully", () => {
    const map = buildThreadMap([{ id: "m1", parentId: "missing" }]);
    expect(computeDepth("m1", map)).toBe(1);
  });
});

describe("resolveParent", () => {
  it("allows replies within depth limit", () => {
    const map = makeChain(3);
    const result = resolveParent("m2", map, 5);
    expect(result.exceedsLimit).toBe(false);
    expect(result.resolvedParentId).toBe("m2");
    expect(result.depth).toBe(3);
  });

  it("re-parents when exceeding depth limit", () => {
    const map = makeChain(6); // m0..m5, depths 0..5
    const result = resolveParent("m5", map, 5);
    expect(result.exceedsLimit).toBe(true);
    expect(result.depth).toBe(5);
    // Should walk up from m5 (depth 5) to find a parent at depth < 5
  });

  it("handles unknown parent gracefully", () => {
    const map = buildThreadMap([]);
    const result = resolveParent("unknown", map, 5);
    expect(result.exceedsLimit).toBe(false);
    expect(result.resolvedParentId).toBe("unknown");
  });

  it("uses DEFAULT_MAX_DEPTH when not specified", () => {
    const map = makeChain(3);
    const result = resolveParent("m2", map);
    expect(result.exceedsLimit).toBe(false);
    expect(DEFAULT_MAX_DEPTH).toBe(5);
  });
});

describe("getThreadRoot", () => {
  it("returns root message id", () => {
    const map = makeChain(4);
    expect(getThreadRoot("m3", map)).toBe("m0");
    expect(getThreadRoot("m0", map)).toBe("m0");
  });

  it("returns self for unknown messages", () => {
    const map = buildThreadMap([]);
    expect(getThreadRoot("unknown", map)).toBe("unknown");
  });
});

describe("threadSize", () => {
  it("counts all messages in a thread", () => {
    const map = makeChain(4);
    expect(threadSize("m0", map)).toBe(4);
  });

  it("returns 0 for non-existent root", () => {
    const map = buildThreadMap([]);
    expect(threadSize("unknown", map)).toBe(0);
  });

  it("counts branching threads", () => {
    const map = buildThreadMap([
      { id: "root", parentId: null },
      { id: "a", parentId: "root" },
      { id: "b", parentId: "root" },
      { id: "c", parentId: "a" },
    ]);
    expect(threadSize("root", map)).toBe(4);
  });
});
