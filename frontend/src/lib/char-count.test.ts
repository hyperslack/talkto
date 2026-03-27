import { describe, expect, it } from "bun:test";
import { getCharCountInfo, MAX_MESSAGE_LENGTH } from "./message-utils";

describe("getCharCountInfo", () => {
  it("returns correct info for empty content", () => {
    const info = getCharCountInfo("");
    expect(info.length).toBe(0);
    expect(info.remaining).toBe(MAX_MESSAGE_LENGTH);
    expect(info.overLimit).toBe(false);
    expect(info.shouldShow).toBe(false);
  });

  it("does not show counter for short messages", () => {
    const info = getCharCountInfo("Hello world");
    expect(info.shouldShow).toBe(false);
    expect(info.overLimit).toBe(false);
  });

  it("shows counter when within 200 chars of limit", () => {
    const content = "x".repeat(MAX_MESSAGE_LENGTH - 100);
    const info = getCharCountInfo(content);
    expect(info.shouldShow).toBe(true);
    expect(info.remaining).toBe(100);
    expect(info.overLimit).toBe(false);
  });

  it("shows counter at exactly 200 remaining", () => {
    const content = "x".repeat(MAX_MESSAGE_LENGTH - 200);
    const info = getCharCountInfo(content);
    expect(info.shouldShow).toBe(true);
    expect(info.remaining).toBe(200);
  });

  it("marks over limit when exceeding max", () => {
    const content = "x".repeat(MAX_MESSAGE_LENGTH + 50);
    const info = getCharCountInfo(content);
    expect(info.overLimit).toBe(true);
    expect(info.remaining).toBe(-50);
    expect(info.shouldShow).toBe(true);
  });

  it("MAX_MESSAGE_LENGTH is 4000", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(4000);
  });
});
