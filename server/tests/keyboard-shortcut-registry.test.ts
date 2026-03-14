import { describe, expect, test } from "bun:test";
import {
  ShortcutRegistry,
  normalizeKeys,
  formatKeysForDisplay,
  displayShortcut,
  defaultShortcuts,
} from "../src/utils/keyboard-shortcut-registry";

describe("ShortcutRegistry", () => {
  test("register and list shortcuts", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "search", keys: "ctrl+k", label: "Search", category: "search" });
    expect(reg.size).toBe(1);
    expect(reg.list().length).toBe(1);
  });

  test("prevents conflicting key combos", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    const ok = reg.register({ id: "b", keys: "ctrl+k", label: "B", category: "general" });
    expect(ok).toBe(false);
    expect(reg.size).toBe(1);
  });

  test("allows re-registering same id", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    const ok = reg.register({ id: "a", keys: "ctrl+k", label: "Updated A", category: "search" });
    expect(ok).toBe(true);
  });

  test("unregister removes shortcut", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    expect(reg.unregister("a")).toBe(true);
    expect(reg.size).toBe(0);
  });

  test("findByKeys finds shortcut", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    expect(reg.findByKeys("ctrl+k")?.id).toBe("a");
    expect(reg.findByKeys("ctrl+j")).toBeUndefined();
  });

  test("list filters by category", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    reg.register({ id: "b", keys: "ctrl+b", label: "B", category: "formatting" });
    expect(reg.list("search").length).toBe(1);
    expect(reg.list("formatting").length).toBe(1);
  });

  test("categories returns unique categories", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    reg.register({ id: "b", keys: "ctrl+b", label: "B", category: "search" });
    reg.register({ id: "c", keys: "ctrl+i", label: "C", category: "formatting" });
    expect(reg.categories()).toEqual(["formatting", "search"]);
  });

  test("hasConflict detects conflicts", () => {
    const reg = new ShortcutRegistry();
    reg.register({ id: "a", keys: "ctrl+k", label: "A", category: "search" });
    expect(reg.hasConflict("ctrl+k")).toBe(true);
    expect(reg.hasConflict("ctrl+k", "a")).toBe(false); // excluding self
    expect(reg.hasConflict("ctrl+j")).toBe(false);
  });
});

describe("normalizeKeys", () => {
  test("lowercases and sorts modifiers", () => {
    expect(normalizeKeys("Shift+Ctrl+K")).toBe("ctrl+shift+k");
  });

  test("handles single key", () => {
    expect(normalizeKeys("Enter")).toBe("enter");
  });

  test("normalizes Cmd as modifier", () => {
    expect(normalizeKeys("cmd+k")).toBe("cmd+k");
  });
});

describe("formatKeysForDisplay", () => {
  test("formats for Windows/Linux", () => {
    expect(formatKeysForDisplay("ctrl+k")).toBe("Ctrl + K");
  });

  test("formats for Mac with symbols", () => {
    expect(formatKeysForDisplay("cmd+k", true)).toBe("⌘K");
  });

  test("formats shift for Mac", () => {
    expect(formatKeysForDisplay("shift+enter", true)).toBe("⇧Enter");
  });
});

describe("displayShortcut", () => {
  test("uses macKeys on Mac", () => {
    const s = { id: "a", keys: "ctrl+k", macKeys: "cmd+k", label: "A", category: "search" as const };
    expect(displayShortcut(s, true)).toBe("⌘K");
    expect(displayShortcut(s, false)).toBe("Ctrl + K");
  });

  test("falls back to keys when no macKeys", () => {
    const s = { id: "a", keys: "enter", label: "A", category: "general" as const };
    expect(displayShortcut(s, true)).toBe("Enter");
  });
});

describe("defaultShortcuts", () => {
  test("returns a non-empty array of shortcuts", () => {
    const defaults = defaultShortcuts();
    expect(defaults.length).toBeGreaterThan(5);
    expect(defaults.every((s) => s.id && s.keys && s.label && s.category)).toBe(true);
  });

  test("all default shortcuts register without conflicts", () => {
    const reg = new ShortcutRegistry();
    for (const s of defaultShortcuts()) {
      expect(reg.register(s)).toBe(true);
    }
  });
});
