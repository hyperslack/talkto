import { describe, it, expect } from "bun:test";
import {
  createNavState,
  moveNext,
  movePrev,
  moveTo,
  getFocused,
  moveToFirst,
  moveToLast,
  typeAhead,
} from "../src/utils/keyboard-navigation";

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Charlie" },
  { id: "d", label: "Delta" },
];

describe("createNavState", () => {
  it("creates with initial index", () => {
    const state = createNavState(items, 2);
    expect(state.focusedIndex).toBe(2);
    expect(state.wrap).toBe(true);
  });

  it("clamps out-of-bounds index", () => {
    const state = createNavState(items, 99);
    expect(state.focusedIndex).toBe(3);
  });
});

describe("moveNext", () => {
  it("moves to next item", () => {
    const state = createNavState(items, 0);
    const next = moveNext(state);
    expect(next.focusedIndex).toBe(1);
  });

  it("wraps around when at end", () => {
    const state = createNavState(items, 3);
    const next = moveNext(state);
    expect(next.focusedIndex).toBe(0);
  });

  it("does not wrap when wrap=false", () => {
    const state = createNavState(items, 3, false);
    const next = moveNext(state);
    expect(next.focusedIndex).toBe(3);
  });

  it("skips disabled items", () => {
    const withDisabled = [
      { id: "a", label: "A" },
      { id: "b", label: "B", disabled: true },
      { id: "c", label: "C" },
    ];
    const state = createNavState(withDisabled, 0);
    const next = moveNext(state);
    expect(next.focusedIndex).toBe(2);
  });

  it("handles empty items", () => {
    const state = createNavState([], 0);
    const next = moveNext(state);
    expect(next.focusedIndex).toBe(0);
  });
});

describe("movePrev", () => {
  it("moves to previous item", () => {
    const state = createNavState(items, 2);
    const prev = movePrev(state);
    expect(prev.focusedIndex).toBe(1);
  });

  it("wraps to end when at start", () => {
    const state = createNavState(items, 0);
    const prev = movePrev(state);
    expect(prev.focusedIndex).toBe(3);
  });
});

describe("moveTo", () => {
  it("moves to item by ID", () => {
    const state = createNavState(items, 0);
    const moved = moveTo(state, "c");
    expect(moved.focusedIndex).toBe(2);
  });

  it("returns unchanged for unknown ID", () => {
    const state = createNavState(items, 0);
    const moved = moveTo(state, "unknown");
    expect(moved.focusedIndex).toBe(0);
  });
});

describe("getFocused", () => {
  it("returns current item", () => {
    const state = createNavState(items, 1);
    expect(getFocused(state)?.id).toBe("b");
  });

  it("returns null for empty", () => {
    expect(getFocused(createNavState([]))).toBeNull();
  });
});

describe("moveToFirst / moveToLast", () => {
  it("moves to first", () => {
    const state = createNavState(items, 3);
    expect(moveToFirst(state).focusedIndex).toBe(0);
  });

  it("moves to last", () => {
    const state = createNavState(items, 0);
    expect(moveToLast(state).focusedIndex).toBe(3);
  });
});

describe("typeAhead", () => {
  it("finds item by prefix", () => {
    const state = createNavState(items, 0);
    const found = typeAhead(state, "ch");
    expect(found.focusedIndex).toBe(2); // Charlie
  });

  it("returns unchanged for no match", () => {
    const state = createNavState(items, 1);
    const found = typeAhead(state, "zzz");
    expect(found.focusedIndex).toBe(1);
  });

  it("is case-insensitive", () => {
    const state = createNavState(items, 0);
    const found = typeAhead(state, "BETA");
    expect(found.focusedIndex).toBe(1);
  });
});
