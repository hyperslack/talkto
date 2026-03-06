/**
 * Tests for link preview extraction.
 */

import { describe, expect, it } from "bun:test";
import {
  extractUrls,
  extractDomain,
  getLinkPreviews,
  isImageUrl,
  isVideoUrl,
} from "../src/lib/link-preview";

describe("extractUrls", () => {
  it("extracts single URL", () => {
    expect(extractUrls("Check https://example.com")).toEqual(["https://example.com"]);
  });

  it("extracts multiple URLs", () => {
    const urls = extractUrls("Visit https://a.com and http://b.com/path");
    expect(urls).toHaveLength(2);
  });

  it("returns empty for no URLs", () => {
    expect(extractUrls("No links here")).toEqual([]);
  });

  it("deduplicates URLs", () => {
    expect(extractUrls("https://x.com https://x.com")).toEqual(["https://x.com"]);
  });

  it("handles URLs with query params", () => {
    const urls = extractUrls("https://example.com/page?q=test&lang=en");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("?q=test");
  });
});

describe("extractDomain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("www.example.com");
  });

  it("returns input for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });
});

describe("getLinkPreviews", () => {
  it("returns previews with URL and domain", () => {
    const previews = getLinkPreviews("Check https://github.com/repo");
    expect(previews).toHaveLength(1);
    expect(previews[0].url).toBe("https://github.com/repo");
    expect(previews[0].domain).toBe("github.com");
  });
});

describe("isImageUrl", () => {
  it("detects image URLs", () => {
    expect(isImageUrl("https://example.com/photo.jpg")).toBe(true);
    expect(isImageUrl("https://example.com/icon.png")).toBe(true);
    expect(isImageUrl("https://example.com/anim.gif")).toBe(true);
  });

  it("rejects non-image URLs", () => {
    expect(isImageUrl("https://example.com/page")).toBe(false);
    expect(isImageUrl("https://example.com/doc.pdf")).toBe(false);
  });
});

describe("isVideoUrl", () => {
  it("detects YouTube URLs", () => {
    expect(isVideoUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isVideoUrl("https://youtu.be/abc")).toBe(true);
  });

  it("detects Vimeo URLs", () => {
    expect(isVideoUrl("https://vimeo.com/123")).toBe(true);
  });

  it("rejects non-video URLs", () => {
    expect(isVideoUrl("https://example.com")).toBe(false);
  });
});
