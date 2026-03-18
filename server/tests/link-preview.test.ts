import { describe, expect, test } from "bun:test";
import {
  extractUrls,
  parseUrl,
  isImageUrl,
  isVideoUrl,
  isGitHubUrl,
  formatDisplayUrl,
  buildPreview,
  extractPreviews,
  countLinks,
  hasLinks,
  uniqueDomains,
  imageLinks,
} from "../src/utils/link-preview";

describe("Link Preview Utilities", () => {
  describe("extractUrls", () => {
    test("extracts single URL", () => {
      expect(extractUrls("check https://example.com")).toEqual(["https://example.com"]);
    });

    test("extracts multiple URLs", () => {
      const result = extractUrls("see https://a.com and http://b.com/path");
      expect(result).toEqual(["https://a.com", "http://b.com/path"]);
    });

    test("deduplicates URLs", () => {
      expect(extractUrls("https://x.com https://x.com")).toEqual(["https://x.com"]);
    });

    test("returns empty for no URLs", () => {
      expect(extractUrls("no links here")).toEqual([]);
    });

    test("returns empty for empty string", () => {
      expect(extractUrls("")).toEqual([]);
    });
  });

  describe("parseUrl", () => {
    test("parses valid URL", () => {
      const result = parseUrl("https://example.com/foo?bar=1");
      expect(result).toEqual({ domain: "example.com", path: "/foo?bar=1" });
    });

    test("returns null for invalid URL", () => {
      expect(parseUrl("not-a-url")).toBeNull();
    });
  });

  describe("isImageUrl", () => {
    test("detects PNG", () => {
      expect(isImageUrl("https://example.com/photo.png")).toBe(true);
    });

    test("detects JPG", () => {
      expect(isImageUrl("https://example.com/photo.jpg")).toBe(true);
    });

    test("rejects non-image", () => {
      expect(isImageUrl("https://example.com/doc.pdf")).toBe(false);
    });

    test("handles invalid URL", () => {
      expect(isImageUrl("bad")).toBe(false);
    });
  });

  describe("isVideoUrl", () => {
    test("detects MP4", () => {
      expect(isVideoUrl("https://example.com/clip.mp4")).toBe(true);
    });

    test("rejects non-video", () => {
      expect(isVideoUrl("https://example.com/page.html")).toBe(false);
    });
  });

  describe("isGitHubUrl", () => {
    test("detects github.com", () => {
      expect(isGitHubUrl("https://github.com/user/repo")).toBe(true);
    });

    test("detects www.github.com", () => {
      expect(isGitHubUrl("https://www.github.com/user/repo")).toBe(true);
    });

    test("rejects other domains", () => {
      expect(isGitHubUrl("https://gitlab.com/user/repo")).toBe(false);
    });
  });

  describe("formatDisplayUrl", () => {
    test("strips protocol and trailing slash", () => {
      expect(formatDisplayUrl("https://www.example.com/")).toBe("example.com");
    });

    test("preserves path", () => {
      expect(formatDisplayUrl("https://example.com/path")).toBe("example.com/path");
    });
  });

  describe("buildPreview", () => {
    test("builds preview for valid URL", () => {
      const p = buildPreview("https://github.com/user/repo");
      expect(p).not.toBeNull();
      expect(p!.domain).toBe("github.com");
      expect(p!.isGitHub).toBe(true);
      expect(p!.isImage).toBe(false);
    });

    test("returns null for invalid URL", () => {
      expect(buildPreview("not-valid")).toBeNull();
    });

    test("detects image preview", () => {
      const p = buildPreview("https://cdn.example.com/img.png");
      expect(p!.isImage).toBe(true);
    });
  });

  describe("extractPreviews", () => {
    test("extracts multiple previews", () => {
      const text = "Look at https://a.com and https://b.com/pic.jpg";
      const result = extractPreviews(text);
      expect(result).toHaveLength(2);
      expect(result[1].isImage).toBe(true);
    });
  });

  describe("countLinks", () => {
    test("counts links in text", () => {
      expect(countLinks("a https://a.com b https://b.com")).toBe(2);
    });

    test("returns 0 for no links", () => {
      expect(countLinks("nothing")).toBe(0);
    });
  });

  describe("hasLinks", () => {
    test("returns true when links present", () => {
      expect(hasLinks("see https://x.com")).toBe(true);
    });

    test("returns false when no links", () => {
      expect(hasLinks("no links")).toBe(false);
    });
  });

  describe("uniqueDomains", () => {
    test("returns unique domains", () => {
      const text = "https://a.com/1 https://a.com/2 https://b.com";
      expect(uniqueDomains(text)).toEqual(["a.com", "b.com"]);
    });
  });

  describe("imageLinks", () => {
    test("filters to image links only", () => {
      const text = "https://a.com/page https://b.com/pic.png https://c.com/vid.mp4";
      const result = imageLinks(text);
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("b.com");
    });
  });
});
