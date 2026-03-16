/**
 * Message content validation — validates and normalizes message content
 * before persistence. Checks for banned patterns, excessive formatting,
 * and content policy violations.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: string;
}

export interface ValidationRule {
  name: string;
  check: (content: string) => string | null; // returns error message or null
}

/** Maximum allowed message length. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Maximum consecutive newlines allowed. */
export const MAX_CONSECUTIVE_NEWLINES = 5;

/** Maximum repeated characters in a row. */
export const MAX_REPEATED_CHARS = 50;

/**
 * Validate message content against all rules.
 */
export function validateContent(content: string, rules?: ValidationRule[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Empty check
  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ["Message content cannot be empty"], warnings: [], normalized: "" };
  }

  // Length check
  if (content.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters (got ${content.length})`);
  }

  // Normalize content
  let normalized = normalizeContent(content);

  // Check for excessive repeated characters
  const repeatedMatch = normalized.match(/(.)\1{49,}/);
  if (repeatedMatch) {
    warnings.push("Message contains excessive repeated characters");
  }

  // Check for only whitespace/formatting
  if (normalized.replace(/[*_~`>\s\n]/g, "").length === 0 && normalized.length > 0) {
    warnings.push("Message contains only formatting characters");
  }

  // Run custom rules
  if (rules) {
    for (const rule of rules) {
      const error = rule.check(normalized);
      if (error) {
        errors.push(`[${rule.name}] ${error}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, normalized };
}

/**
 * Normalize message content:
 * - Trim leading/trailing whitespace
 * - Collapse excessive newlines
 * - Remove control characters (except \n, \t)
 */
export function normalizeContent(content: string): string {
  let result = content.trim();

  // Remove control characters except \n and \t
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Collapse excessive newlines
  const maxNewlines = "\n".repeat(MAX_CONSECUTIVE_NEWLINES);
  const excessiveNewlines = new RegExp(`\n{${MAX_CONSECUTIVE_NEWLINES + 1},}`, "g");
  result = result.replace(excessiveNewlines, maxNewlines);

  return result;
}

/**
 * Check if content contains any @mentions.
 */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@[\w.-]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/**
 * Check if a message is likely spam based on heuristics.
 */
export function isLikelySpam(content: string): boolean {
  // All caps (if over 20 chars)
  if (content.length > 20 && content === content.toUpperCase() && /[A-Z]/.test(content)) {
    return true;
  }

  // Excessive repeated characters (>50 in a row)
  if (/(.)\1{49,}/.test(content)) {
    return true;
  }

  // Same word repeated >10 times
  const words = content.toLowerCase().split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
    if (freq.get(w)! > 10 && words.length > 10) return true;
  }

  return false;
}

/**
 * Create a validation rule that rejects messages matching a pattern.
 */
export function createBannedPatternRule(name: string, pattern: RegExp, message: string): ValidationRule {
  return {
    name,
    check: (content) => pattern.test(content) ? message : null,
  };
}

/**
 * Create a validation rule that enforces minimum content length after normalization.
 */
export function createMinLengthRule(minLength: number): ValidationRule {
  return {
    name: "min-length",
    check: (content) => {
      const stripped = content.replace(/\s+/g, "").length;
      return stripped < minLength ? `Message must be at least ${minLength} non-whitespace characters` : null;
    },
  };
}
