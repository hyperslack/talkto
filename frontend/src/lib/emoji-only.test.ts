import { describe, it, expect } from "bun:test";
import { isEmojiOnly } from "./message-utils";

describe("isEmojiOnly", () => {
  it("returns true for a single emoji", () => {
    expect(isEmojiOnly("👍")).toBe(true);
  });

  it("returns true for multiple emoji", () => {
    expect(isEmojiOnly("🔥🎉")).toBe(true);
  });

  it("returns true for three emoji", () => {
    expect(isEmojiOnly("😂❤️🙌")).toBe(true);
  });

  it("returns false for text with emoji", () => {
    expect(isEmojiOnly("hello 👍")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isEmojiOnly("hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEmojiOnly("")).toBe(false);
  });

  it("returns false for whitespace only", () => {
    expect(isEmojiOnly("   ")).toBe(false);
  });

  it("returns true for emoji with variation selector", () => {
    expect(isEmojiOnly("❤️")).toBe(true);
  });
});
