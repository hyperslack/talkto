/**
 * Workspace word filter — configurable content moderation with
 * word/phrase banning, replacement, and detection.
 */

export type FilterAction = "block" | "replace" | "flag";

export interface FilterRule {
  pattern: string;
  action: FilterAction;
  replacement?: string; // only for "replace" action
  caseSensitive?: boolean;
}

export interface FilterResult {
  original: string;
  filtered: string;
  matched: FilterMatch[];
  blocked: boolean;
  flagged: boolean;
}

export interface FilterMatch {
  pattern: string;
  action: FilterAction;
  position: number;
  length: number;
}

/**
 * Configurable word filter with support for exact words, phrases, and patterns.
 */
export class WordFilter {
  private rules: FilterRule[] = [];

  /**
   * Add a filter rule.
   */
  addRule(rule: FilterRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a filter rule by pattern.
   */
  removeRule(pattern: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.pattern !== pattern);
    return this.rules.length < before;
  }

  /**
   * List all rules.
   */
  listRules(): FilterRule[] {
    return [...this.rules];
  }

  /**
   * Apply the filter to content.
   */
  apply(content: string): FilterResult {
    const matches: FilterMatch[] = [];
    let filtered = content;
    let blocked = false;
    let flagged = false;

    for (const rule of this.rules) {
      const flags = rule.caseSensitive ? "g" : "gi";
      const escaped = escapeRegex(rule.pattern);
      const regex = new RegExp(`\\b${escaped}\\b`, flags);

      let match: RegExpExecArray | null;
      // We need a fresh regex for exec loop
      const searchRegex = new RegExp(`\\b${escaped}\\b`, flags);

      while ((match = searchRegex.exec(content)) !== null) {
        matches.push({
          pattern: rule.pattern,
          action: rule.action,
          position: match.index,
          length: match[0].length,
        });
      }

      if (rule.action === "block" && regex.test(content)) {
        blocked = true;
      } else if (rule.action === "replace") {
        const replacement = rule.replacement ?? "*".repeat(rule.pattern.length);
        filtered = filtered.replace(regex, replacement);
      } else if (rule.action === "flag" && regex.test(content)) {
        flagged = true;
      }
    }

    return { original: content, filtered, matched: matches, blocked, flagged };
  }

  /**
   * Quick check if content contains any blocked words.
   */
  containsBlocked(content: string): boolean {
    for (const rule of this.rules) {
      if (rule.action !== "block") continue;
      const flags = rule.caseSensitive ? "g" : "gi";
      const regex = new RegExp(`\\b${escapeRegex(rule.pattern)}\\b`, flags);
      if (regex.test(content)) return true;
    }
    return false;
  }

  /**
   * Get the count of rules.
   */
  ruleCount(): number {
    return this.rules.length;
  }

  /**
   * Clear all rules.
   */
  clear(): void {
    this.rules = [];
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a default replacement string (asterisks matching word length).
 */
export function censorWord(word: string): string {
  if (word.length <= 1) return "*";
  return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
}

/**
 * Create a WordFilter with a preset list of blocked words.
 */
export function createFilterFromList(words: string[], action: FilterAction = "replace"): WordFilter {
  const filter = new WordFilter();
  for (const word of words) {
    filter.addRule({ pattern: word, action });
  }
  return filter;
}
