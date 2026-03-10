import { describe, it, expect } from "bun:test";
import { getCharCountInfo, MAX_MESSAGE_LENGTH } from "./char-counter";

describe("getCharCountInfo", () => {
  it("returns correct info for empty string", () => {
    const info = getCharCountInfo("");
    expect(info.length).toBe(0);
    expect(info.remaining).toBe(MAX_MESSAGE_LENGTH);
    expect(info.overLimit).toBe(false);
    expect(info.shouldShow).toBe(false);
  });

  it("does not show counter for short messages", () => {
    const info = getCharCountInfo("hello");
    expect(info.shouldShow).toBe(false);
    expect(info.remaining).toBe(MAX_MESSAGE_LENGTH - 5);
  });

  it("shows counter when approaching limit", () => {
    const text = "a".repeat(MAX_MESSAGE_LENGTH - 100);
    const info = getCharCountInfo(text);
    expect(info.shouldShow).toBe(true);
    expect(info.remaining).toBe(100);
    expect(info.overLimit).toBe(false);
  });

  it("detects over-limit messages", () => {
    const text = "a".repeat(MAX_MESSAGE_LENGTH + 10);
    const info = getCharCountInfo(text);
    expect(info.overLimit).toBe(true);
    expect(info.remaining).toBe(-10);
    expect(info.shouldShow).toBe(true);
  });

  it("shows counter at exactly the threshold", () => {
    const text = "a".repeat(MAX_MESSAGE_LENGTH - 200);
    const info = getCharCountInfo(text);
    expect(info.shouldShow).toBe(true);
    expect(info.remaining).toBe(200);
  });

  it("shows counter at exactly max length", () => {
    const text = "a".repeat(MAX_MESSAGE_LENGTH);
    const info = getCharCountInfo(text);
    expect(info.remaining).toBe(0);
    expect(info.overLimit).toBe(false);
    expect(info.shouldShow).toBe(true);
  });
});
