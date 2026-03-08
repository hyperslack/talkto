/**
 * Tests for channel welcome message.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { WelcomeMessageSchema, welcomeMessages } from "../src/routes/channel-welcome";

beforeEach(() => {
  welcomeMessages.clear();
});

describe("WelcomeMessageSchema", () => {
  it("accepts a valid welcome message", () => {
    const result = WelcomeMessageSchema.safeParse({ message: "Welcome to #general!" });
    expect(result.success).toBe(true);
  });

  it("accepts empty message to clear", () => {
    const result = WelcomeMessageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects message over 2000 chars", () => {
    const result = WelcomeMessageSchema.safeParse({ message: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("welcomeMessages store", () => {
  it("stores and retrieves welcome messages", () => {
    welcomeMessages.set("ch-1", "Hello!");
    expect(welcomeMessages.get("ch-1")).toBe("Hello!");
  });

  it("clears welcome messages", () => {
    welcomeMessages.set("ch-1", "Hello!");
    welcomeMessages.delete("ch-1");
    expect(welcomeMessages.has("ch-1")).toBe(false);
  });

  it("overwrites existing messages", () => {
    welcomeMessages.set("ch-1", "Old");
    welcomeMessages.set("ch-1", "New");
    expect(welcomeMessages.get("ch-1")).toBe("New");
  });

  it("returns undefined for missing channels", () => {
    expect(welcomeMessages.get("nonexistent")).toBeUndefined();
  });
});
