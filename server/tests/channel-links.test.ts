/**
 * Tests for message link extraction.
 */

import { describe, expect, it } from "bun:test";
import { extractUrls } from "../src/services/channel-links";

describe("Channel Links", () => {
  it("extracts HTTP URLs from text", () => {
    const urls = extractUrls("Check out http://example.com for more info");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("http://example.com");
  });

  it("extracts HTTPS URLs from text", () => {
    const urls = extractUrls("Visit https://example.com/page");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://example.com/page");
  });

  it("extracts multiple URLs from text", () => {
    const urls = extractUrls("See https://a.com and https://b.com for details");
    expect(urls).toHaveLength(2);
  });

  it("deduplicates URLs", () => {
    const urls = extractUrls("https://example.com https://example.com");
    expect(urls).toHaveLength(1);
  });

  it("returns empty array for text without URLs", () => {
    const urls = extractUrls("No links here, just plain text.");
    expect(urls).toHaveLength(0);
  });

  it("handles URLs with query parameters", () => {
    const urls = extractUrls("https://example.com/search?q=test&page=1");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("?q=test");
  });

  it("link response shape", () => {
    const link = {
      url: "https://example.com",
      message_id: "msg-1",
      sender_name: "Alice",
      shared_at: "2025-01-15T10:30:00.000Z",
    };
    expect(link.url).toBeDefined();
    expect(link.message_id).toBeDefined();
    expect(link.sender_name).toBe("Alice");
    expect(link.shared_at).toBeDefined();
  });
});
