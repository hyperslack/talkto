import { describe, expect, it } from "vitest";
import { extractMentionTokens } from "./mention-token";

describe("extractMentionTokens", () => {
  it("returns unique normalized mention names", () => {
    expect(extractMentionTokens("Hi @Nelly and @nelly and @dev_bot")).toEqual([
      "nelly",
      "dev_bot",
    ]);
  });

  it("returns empty array when there are no mentions", () => {
    expect(extractMentionTokens("hello world")).toEqual([]);
  });
});
