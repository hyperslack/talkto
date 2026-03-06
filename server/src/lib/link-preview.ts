/**
 * Link preview extraction — extract URLs from message content and return metadata.
 *
 * Extracts URLs from text, with support for common patterns.
 * Metadata fetching (title, description, image) can be done client-side or via a future endpoint.
 */

/** URL regex that matches http/https URLs in text */
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

export interface LinkPreview {
  url: string;
  domain: string;
}

/** Extract all URLs from message content */
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}

/** Extract domain from a URL */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Get link previews (URL + domain) from message content */
export function getLinkPreviews(content: string): LinkPreview[] {
  return extractUrls(content).map((url) => ({
    url,
    domain: extractDomain(url),
  }));
}

/** Check if a URL is an image URL (by extension) */
export function isImageUrl(url: string): boolean {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"];
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return imageExtensions.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/** Check if a URL is a video URL (YouTube, Vimeo, etc.) */
export function isVideoUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com") ||
      hostname.includes("twitch.tv")
    );
  } catch {
    return false;
  }
}
