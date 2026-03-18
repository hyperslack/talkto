/**
 * Mention autocomplete utilities.
 *
 * Fuzzy matching and ranking for @mention suggestions
 * in the message input. Supports users and agents.
 */

export interface MentionCandidate {
  id: string;
  name: string;
  displayName?: string | null;
  type: "human" | "agent";
  isOnline?: boolean;
}

export interface MentionSuggestion extends MentionCandidate {
  score: number;
  matchedField: "name" | "displayName";
}

/**
 * Detect if the user is currently typing a mention.
 * Returns the partial text after @ or null.
 */
export function detectMentionTrigger(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  return match ? match[1] : null;
}

/**
 * Fuzzy match score: how well does query match target?
 * Returns 0 (no match) to 1 (perfect match).
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0.5; // empty query matches everything weakly
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 1.0;

  // Starts with
  if (t.startsWith(q)) return 0.9;

  // Contains
  if (t.includes(q)) return 0.7;

  // Subsequence match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return 0.4;

  return 0;
}

/**
 * Search candidates and return ranked suggestions.
 */
export function searchMentions(
  query: string,
  candidates: MentionCandidate[],
  limit = 10
): MentionSuggestion[] {
  const suggestions: MentionSuggestion[] = [];

  for (const c of candidates) {
    const nameScore = fuzzyScore(query, c.name);
    const displayScore = c.displayName ? fuzzyScore(query, c.displayName) : 0;

    const bestScore = Math.max(nameScore, displayScore);
    if (bestScore > 0) {
      suggestions.push({
        ...c,
        score: bestScore,
        matchedField: displayScore > nameScore ? "displayName" : "name",
      });
    }
  }

  // Sort by score desc, then online first, then alphabetical
  suggestions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return suggestions.slice(0, limit);
}

/**
 * Insert a mention into text at cursor position.
 * Replaces the @partial with @name and adds a trailing space.
 */
export function insertMention(
  text: string,
  cursorPos: number,
  mentionName: string
): { text: string; newCursorPos: number } {
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return { text, newCursorPos: cursorPos };

  const newText = before.slice(0, atIndex) + `@${mentionName} ` + after;
  const newCursorPos = atIndex + mentionName.length + 2; // +2 for @ and space
  return { text: newText, newCursorPos };
}

/**
 * Format a mention for display: @name or @displayName.
 */
export function formatMention(candidate: MentionCandidate): string {
  return `@${candidate.displayName ?? candidate.name}`;
}

/**
 * Check whether text contains a mention of a specific user.
 */
export function hasMention(text: string, name: string): boolean {
  const regex = new RegExp(`@${name}\\b`, "i");
  return regex.test(text);
}

/**
 * Extract all @mentions from text.
 */
export function extractMentionNames(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
