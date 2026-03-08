/**
 * Tests for message permalink URL generation.
 */

import { describe, expect, it } from "vitest";

function buildPermalink(origin: string, channelId: string, messageId: string): string {
  return `${origin}/?channel=${channelId}&message=${messageId}`;
}

describe("Message permalink", () => {
  it("generates correct permalink URL format", () => {
    const url = buildPermalink("http://localhost:5173", "ch-123", "msg-456");
    expect(url).toBe("http://localhost:5173/?channel=ch-123&message=msg-456");
  });

  it("includes both channel and message params", () => {
    const url = buildPermalink("https://talkto.example.com", "abc", "def");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("channel")).toBe("abc");
    expect(parsed.searchParams.get("message")).toBe("def");
  });

  it("handles UUIDs correctly", () => {
    const channelId = "885d930b-d9a7-48df-8be2-afaf6cd071cd";
    const messageId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const url = buildPermalink("http://localhost:5173", channelId, messageId);
    expect(url).toContain(channelId);
    expect(url).toContain(messageId);
  });
});
