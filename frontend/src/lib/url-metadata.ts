/**
 * URL metadata parsing — extract and classify URLs in messages
 * for rich link previews (unfurling).
 */

export interface ParsedUrl {
  url: string;
  domain: string;
  type: "image" | "video" | "github" | "twitter" | "youtube" | "generic";
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv"]);

/** Extract all URLs from a message string. */
export function extractUrls(text: string): string[] {
  const regex = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...(text.match(regex) ?? [])];
}

/** Parse a URL into a typed metadata object. */
export function parseUrl(url: string): ParsedUrl {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const ext = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";

    return {
      url,
      domain,
      type: classifyUrl(domain, parsed.pathname, ext),
    };
  } catch {
    return { url, domain: "", type: "generic" };
  }
}

/** Classify URL by domain and extension. */
function classifyUrl(domain: string, pathname: string, ext: string): ParsedUrl["type"] {
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (domain.includes("github.com")) return "github";
  if (domain.includes("twitter.com") || domain.includes("x.com")) return "twitter";
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "youtube";
  return "generic";
}

/** Extract and parse all URLs in a message. */
export function parseMessageUrls(text: string): ParsedUrl[] {
  return extractUrls(text).map(parseUrl);
}

/** Check if a URL points to an image. */
export function isImageUrl(url: string): boolean {
  return parseUrl(url).type === "image";
}

/** Check if a URL points to a video. */
export function isVideoUrl(url: string): boolean {
  return parseUrl(url).type === "video";
}

/** Get unique domains from a list of URLs. */
export function uniqueDomains(urls: string[]): string[] {
  const domains = new Set(urls.map((u) => parseUrl(u).domain).filter(Boolean));
  return [...domains];
}

/** Count URLs by type in a message. */
export function countByType(text: string): Record<ParsedUrl["type"], number> {
  const parsed = parseMessageUrls(text);
  const counts: Record<string, number> = {
    image: 0, video: 0, github: 0, twitter: 0, youtube: 0, generic: 0,
  };
  for (const p of parsed) {
    counts[p.type] = (counts[p.type] ?? 0) + 1;
  }
  return counts as Record<ParsedUrl["type"], number>;
}
