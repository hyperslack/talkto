import { describe, expect, test } from "bun:test";
import {
  getExtension,
  guessMimeType,
  categorize,
  formatSize,
  buildMeta,
  validateAttachment,
  isPreviewable,
  categoryIcon,
} from "../src/utils/attachment-metadata";

describe("Attachment Metadata Utilities", () => {
  test("getExtension extracts extension", () => {
    expect(getExtension("photo.png")).toBe(".png");
    expect(getExtension("PHOTO.JPG")).toBe(".jpg");
    expect(getExtension("noext")).toBe("");
    expect(getExtension("file.")).toBe("");
  });

  test("guessMimeType from filename", () => {
    expect(guessMimeType("img.png")).toBe("image/png");
    expect(guessMimeType("doc.pdf")).toBe("application/pdf");
    expect(guessMimeType("unknown.xyz")).toBe("application/octet-stream");
  });

  test("categorize identifies types", () => {
    expect(categorize("image/png")).toBe("image");
    expect(categorize("video/mp4")).toBe("video");
    expect(categorize("audio/mpeg")).toBe("audio");
    expect(categorize("application/pdf")).toBe("document");
    expect(categorize("text/javascript")).toBe("code");
    expect(categorize("application/zip")).toBe("archive");
    expect(categorize("application/octet-stream")).toBe("other");
  });

  test("formatSize formats bytes", () => {
    expect(formatSize(500)).toBe("500 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  test("buildMeta creates full metadata", () => {
    const meta = buildMeta("photo.png", 1024);
    expect(meta.extension).toBe(".png");
    expect(meta.mimeType).toBe("image/png");
    expect(meta.category).toBe("image");
    expect(meta.sizeFormatted).toBe("1.0 KB");
  });

  test("validateAttachment accepts valid file", () => {
    expect(validateAttachment("file.txt", 1024).valid).toBe(true);
  });

  test("validateAttachment rejects empty filename", () => {
    const result = validateAttachment("", 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Filename");
  });

  test("validateAttachment rejects zero size", () => {
    expect(validateAttachment("f.txt", 0).valid).toBe(false);
  });

  test("validateAttachment rejects oversized file", () => {
    const result = validateAttachment("big.zip", 30 * 1024 * 1024, 25);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("25MB");
  });

  test("validateAttachment rejects disallowed category", () => {
    const result = validateAttachment("app.zip", 1024, 25, ["image", "document"]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  test("isPreviewable for images", () => {
    expect(isPreviewable("photo.png")).toBe(true);
    expect(isPreviewable("clip.mp4")).toBe(true);
    expect(isPreviewable("doc.pdf")).toBe(false);
  });

  test("categoryIcon returns emoji", () => {
    expect(categoryIcon("image")).toBe("🖼️");
    expect(categoryIcon("code")).toBe("💻");
    expect(categoryIcon("other")).toBe("📎");
  });
});
