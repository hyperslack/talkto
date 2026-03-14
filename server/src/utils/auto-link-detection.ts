/**
 * Auto-link detection utilities for message content.
 *
 * Detects URLs, email addresses, and special patterns (GitHub issues, etc.)
 * and provides structured data for rendering clickable links.
 */

export type LinkType = "url" | "email" | "github_issue" | "github_pr" | "channel_ref";

export interface DetectedLink {
  type: LinkType;
  text: string;
  href: string;
  start: number;
  end: number;
}

const URL_REGEX = /https?:\/\/[^\s<>)"'\]]+/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const GITHUB_ISSUE_REGEX = /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g;
const CHANNEL_REF_REGEX = /#([a-z0-9][a-z0-9_-]{0,79})/g;

/**
 * Detect all links in message content.
 */
export function detectLinks(content: string): DetectedLink[] {
  const links: DetectedLink[] = [];

  // URLs
  for (const match of content.matchAll(URL_REGEX)) {
    // Strip trailing punctuation that's likely not part of the URL
    let url = match[0];
    while (url.endsWith(".") || url.endsWith(",") || url.endsWith(";")) {
      url = url.slice(0, -1);
    }
    links.push({
      type: "url",
      text: url,
      href: url,
      start: match.index!,
      end: match.index! + url.length,
    });
  }

  // Emails (only if not already part of a URL)
  for (const match of content.matchAll(EMAIL_REGEX)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (!links.some((l) => start >= l.start && end <= l.end)) {
      links.push({
        type: "email",
        text: match[0],
        href: `mailto:${match[0]}`,
        start,
        end,
      });
    }
  }

  // GitHub issues/PRs (owner/repo#123)
  for (const match of content.matchAll(GITHUB_ISSUE_REGEX)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (!links.some((l) => start >= l.start && end <= l.end)) {
      const num = parseInt(match[2], 10);
      links.push({
        type: num > 0 ? "github_issue" : "github_issue",
        text: match[0],
        href: `https://github.com/${match[1]}/issues/${match[2]}`,
        start,
        end,
      });
    }
  }

  // Sort by position
  links.sort((a, b) => a.start - b.start);
  return links;
}

/**
 * Detect channel references (#channel-name) in content.
 * Returns just the channel names for lookup.
 */
export function detectChannelRefs(content: string): string[] {
  const refs: string[] = [];
  for (const match of content.matchAll(CHANNEL_REF_REGEX)) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
}

/**
 * Count links by type in a message.
 */
export function countLinksByType(links: DetectedLink[]): Record<LinkType, number> {
  const counts: Record<LinkType, number> = {
    url: 0,
    email: 0,
    github_issue: 0,
    github_pr: 0,
    channel_ref: 0,
  };
  for (const l of links) {
    counts[l.type]++;
  }
  return counts;
}

/**
 * Extract unique domains from detected URL links.
 */
export function uniqueDomains(links: DetectedLink[]): string[] {
  const domains = new Set<string>();
  for (const l of links) {
    if (l.type === "url") {
      try {
        domains.add(new URL(l.href).hostname);
      } catch {
        // skip invalid
      }
    }
  }
  return Array.from(domains).sort();
}

/**
 * Check if content contains any links.
 */
export function hasLinks(content: string): boolean {
  return URL_REGEX.test(content) || EMAIL_REGEX.test(content);
}
