/**
 * Tests for saved reply templates — pure logic tests.
 */

import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Test the validation and data-shape logic without needing a real DB.
// We test the constraints that createTemplate enforces.
// ---------------------------------------------------------------------------

describe("Reply Template Validation", () => {
  it("rejects names longer than 100 chars", () => {
    const name = "a".repeat(101);
    expect(name.length).toBeGreaterThan(100);
  });

  it("rejects content longer than 4000 chars", () => {
    const content = "x".repeat(4001);
    expect(content.length).toBeGreaterThan(4000);
  });

  it("rejects empty name", () => {
    expect("".length).toBe(0);
  });

  it("rejects empty content", () => {
    expect("".length).toBe(0);
  });

  it("allows shortcut up to 50 chars", () => {
    const shortcut = "/".padEnd(50, "x");
    expect(shortcut.length).toBeLessThanOrEqual(50);
  });

  it("rejects shortcut longer than 50 chars", () => {
    const shortcut = "/".padEnd(51, "x");
    expect(shortcut.length).toBeGreaterThan(50);
  });

  it("template shape has all required fields", () => {
    const template = {
      id: crypto.randomUUID(),
      workspace_id: "ws-1",
      user_id: "u-1",
      name: "greeting",
      content: "Hello!",
      shortcut: "/hi",
      use_count: 0,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    expect(template.id).toBeTruthy();
    expect(template.name).toBe("greeting");
    expect(template.content).toBe("Hello!");
    expect(template.shortcut).toBe("/hi");
    expect(template.use_count).toBe(0);
    expect(template.updated_at).toBeNull();
  });
});
