/**
 * Link preview extraction utilities.
 *
 * Extracts URLs from message content and provides metadata helpers
 * for rendering rich link previews in the UI.
 */

export interface LinkPreview {
  url: string;
  domain: string;
  path: string;
  isImage: boolean;
  isVideo: boolean;
  isGitHub: boolean;
  displayUrl: string;
}

const URL_REGEX = /https?:\/\/[^\s<>'")\]]+/gi;

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".webm", ".mov", ".avi", ".mkv",
]);

/** Extract all URLs from a message string. */
export function extractUrls(content: string): string[] {
  if (!content) return [];
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  // Deduplicate while preserving order
  return [...new Set(matches)];
}

/** Parse a URL into domain and path components. Returns null for invalid URLs. */
export function parseUrl(raw: string): { domain: string; path: string } | null {
  try {
    const u = new URL(raw);
    return { domain: u.hostname, path: u.pathname + u.search + u.hash };
  } catch {
    return null;
  }
}

/** Check whether a URL points to an image based on extension. */
export function isImageUrl(url: string): boolean {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    return ext ? IMAGE_EXTENSIONS.has(`.${ext}`) : false;
  } catch {
    return false;
  }
}

/** Check whether a URL points to a video based on extension. */
export function isVideoUrl(url: string): boolean {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    return ext ? VIDEO_EXTENSIONS.has(`.${ext}`) : false;
  } catch {
    return false;
  }
}

/** Check whether a URL points to a GitHub resource. */
export function isGitHubUrl(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return domain === "github.com" || domain === "www.github.com";
  } catch {
    return false;
  }
}

/** Shorten a URL for display (strip protocol, trailing slash). */
export function formatDisplayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/** Build a LinkPreview object from a raw URL. Returns null for invalid URLs. */
export function buildPreview(url: string): LinkPreview | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  return {
    url,
    domain: parsed.domain,
    path: parsed.path,
    isImage: isImageUrl(url),
    isVideo: isVideoUrl(url),
    isGitHub: isGitHubUrl(url),
    displayUrl: formatDisplayUrl(url),
  };
}

/** Extract all link previews from message content. */
export function extractPreviews(content: string): LinkPreview[] {
  const urls = extractUrls(content);
  const previews: LinkPreview[] = [];
  for (const url of urls) {
    const p = buildPreview(url);
    if (p) previews.push(p);
  }
  return previews;
}

/** Count how many links a message contains. */
export function countLinks(content: string): number {
  return extractUrls(content).length;
}

/** Check whether a message contains any links. */
export function hasLinks(content: string): boolean {
  return URL_REGEX.test(content);
}

/** Get unique domains from a message. */
export function uniqueDomains(content: string): string[] {
  const previews = extractPreviews(content);
  return [...new Set(previews.map((p) => p.domain))];
}

/** Filter previews to only images. */
export function imageLinks(content: string): LinkPreview[] {
  return extractPreviews(content).filter((p) => p.isImage);
}
