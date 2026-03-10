import { describe, it, expect } from "bun:test";
import { SHORTCUTS } from "@/lib/shortcuts";

describe("ShortcutsDialog", () => {
  it("exports a non-empty shortcuts list", () => {
    expect(SHORTCUTS.length).toBeGreaterThan(0);
  });

  it("each shortcut has keys and description", () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("includes search shortcut", () => {
    const search = SHORTCUTS.find((s) => s.description.toLowerCase().includes("search"));
    expect(search).toBeDefined();
    expect(search!.keys).toContain("K");
  });

  it("includes the ? shortcut for help itself", () => {
    const help = SHORTCUTS.find((s) => s.keys.includes("?"));
    expect(help).toBeDefined();
  });

  it("has unique descriptions", () => {
    const descriptions = SHORTCUTS.map((s) => s.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
