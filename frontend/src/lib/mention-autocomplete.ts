/** Mention auto-complete utilities for @-mentions in message input. */

export interface MentionCandidate {
  name: string;
  displayName?: string | null;
  type: "human" | "agent";
}

export interface MentionMatch {
  /** The partial text after @ being typed */
  query: string;
  /** Start index of the @ in the input string */
  startIndex: number;
}

/**
 * Detect if the user is currently typing an @-mention.
 * Returns the partial query and position, or null if not mentioning.
 */
export function detectMention(text: string, cursorPos: number): MentionMatch | null {
  // Walk backwards from cursor to find @
  const before = text.slice(0, cursorPos);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;

  // @ must be at start of input or preceded by whitespace
  if (atIndex > 0 && !/\s/.test(before[atIndex - 1])) return null;

  const query = before.slice(atIndex + 1);

  // Query must not contain spaces (stop matching after space)
  if (/\s/.test(query)) return null;

  return { query, startIndex: atIndex };
}

/**
 * Filter candidates by a partial query string.
 * Matches against name and displayName (case-insensitive).
 */
export function filterCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit = 8,
): MentionCandidate[] {
  if (!query) return candidates.slice(0, limit);
  const q = query.toLowerCase();
  return candidates
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.displayName?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, limit);
}

/**
 * Apply a mention selection — replaces the @query with @name and adds a space.
 */
export function applyMention(
  text: string,
  match: MentionMatch,
  selectedName: string,
): string {
  const before = text.slice(0, match.startIndex);
  const after = text.slice(match.startIndex + 1 + match.query.length);
  return `${before}@${selectedName} ${after}`;
}
