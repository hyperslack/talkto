/**
 * Tests for URL metadata parsing.
 */

import { describe, expect, it } from "bun:test";
import {
  extractUrls,
  parseUrl,
  parseMessageUrls,
  isImageUrl,
  isVideoUrl,
  uniqueDomains,
  countByType,
} from "./url-metadata";

describe("extractUrls", () => {
  it("extracts URLs from text", () => {
    const urls = extractUrls("Check https://example.com and http://test.org/page");
    expect(urls).toEqual(["https://example.com", "http://test.org/page"]);
  });

  it("returns empty array for text without URLs", () => {
    expect(extractUrls("no urls here")).toEqual([]);
  });

  it("handles multiple URLs in one line", () => {
    const urls = extractUrls("https://a.com https://b.com");
    expect(urls.length).toBe(2);
  });
});

describe("parseUrl", () => {
  it("classifies image URLs", () => {
    expect(parseUrl("https://example.com/photo.jpg").type).toBe("image");
    expect(parseUrl("https://example.com/img.png").type).toBe("image");
  });

  it("classifies video URLs", () => {
    expect(parseUrl("https://example.com/clip.mp4").type).toBe("video");
  });

  it("classifies GitHub URLs", () => {
    expect(parseUrl("https://github.com/user/repo").type).toBe("github");
  });

  it("classifies YouTube URLs", () => {
    expect(parseUrl("https://youtube.com/watch?v=abc").type).toBe("youtube");
    expect(parseUrl("https://youtu.be/abc").type).toBe("youtube");
  });

  it("classifies Twitter/X URLs", () => {
    expect(parseUrl("https://twitter.com/user/status/123").type).toBe("twitter");
    expect(parseUrl("https://x.com/user/status/123").type).toBe("twitter");
  });

  it("falls back to generic", () => {
    expect(parseUrl("https://example.com/page").type).toBe("generic");
  });

  it("strips www from domain", () => {
    expect(parseUrl("https://www.example.com").domain).toBe("example.com");
  });
});

describe("isImageUrl / isVideoUrl", () => {
  it("detects images", () => {
    expect(isImageUrl("https://a.com/pic.webp")).toBe(true);
    expect(isImageUrl("https://a.com/page")).toBe(false);
  });

  it("detects videos", () => {
    expect(isVideoUrl("https://a.com/vid.mp4")).toBe(true);
    expect(isVideoUrl("https://a.com/page")).toBe(false);
  });
});

describe("uniqueDomains", () => {
  it("deduplicates domains", () => {
    const domains = uniqueDomains([
      "https://a.com/1",
      "https://a.com/2",
      "https://b.com/1",
    ]);
    expect(domains.sort()).toEqual(["a.com", "b.com"]);
  });
});

describe("countByType", () => {
  it("counts URLs by type", () => {
    const text = "Check https://github.com/repo and https://pic.com/img.jpg and https://example.com";
    const counts = countByType(text);
    expect(counts.github).toBe(1);
    expect(counts.image).toBe(1);
    expect(counts.generic).toBe(1);
  });
});
