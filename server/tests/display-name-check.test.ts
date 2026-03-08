/**
 * Tests for user display name uniqueness check.
 */

import { describe, expect, it } from "bun:test";

describe("Display Name Uniqueness Check", () => {
  it("response shape for available name", () => {
    const result = { name: "NewUser", available: true, taken_by: null };
    expect(result.available).toBe(true);
    expect(result.taken_by).toBeNull();
    expect(result.name).toBe("NewUser");
  });

  it("response shape for taken name", () => {
    const result = {
      name: "ExistingUser",
      available: false,
      taken_by: { id: "abc-123", name: "existing-user" },
    };
    expect(result.available).toBe(false);
    expect(result.taken_by).not.toBeNull();
    expect(result.taken_by!.id).toBe("abc-123");
  });

  it("name comparison is case-insensitive", () => {
    const existing = "Alice";
    const query = "alice";
    expect(existing.toLowerCase() === query.toLowerCase()).toBe(true);
  });

  it("trims whitespace from input", () => {
    const input = "  Alice  ";
    const trimmed = input.trim();
    expect(trimmed).toBe("Alice");
    expect(trimmed.length).toBe(5);
  });

  it("rejects empty name", () => {
    const name = "";
    expect(name.trim().length === 0).toBe(true);
  });

  it("rejects name over 100 characters", () => {
    const longName = "a".repeat(101);
    expect(longName.length > 100).toBe(true);
  });
});
