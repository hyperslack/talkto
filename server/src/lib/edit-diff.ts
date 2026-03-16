/**
 * Message edit diff utilities — compute and display differences
 * between message versions for edit history visualization.
 */

export type DiffType = "equal" | "insert" | "delete";

export interface DiffSegment {
  type: DiffType;
  text: string;
}

export interface EditSummary {
  /** Number of characters added. */
  charsAdded: number;
  /** Number of characters removed. */
  charsRemoved: number;
  /** Number of words changed. */
  wordsChanged: number;
  /** Whether the edit was minor (< 10 chars changed). */
  isMinor: boolean;
  /** Human-readable summary. */
  description: string;
}

/**
 * Compute a word-level diff between two texts.
 * Uses a simple LCS (longest common subsequence) approach on words.
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const lcs = longestCommonSubsequence(oldWords, newWords);
  const segments: DiffSegment[] = [];

  let oi = 0, ni = 0, li = 0;

  while (oi < oldWords.length || ni < newWords.length) {
    if (li < lcs.length && oi < oldWords.length && oldWords[oi] === lcs[li] &&
        ni < newWords.length && newWords[ni] === lcs[li]) {
      segments.push({ type: "equal", text: lcs[li] });
      oi++; ni++; li++;
    } else if (li < lcs.length && oi < oldWords.length && oldWords[oi] !== lcs[li]) {
      segments.push({ type: "delete", text: oldWords[oi] });
      oi++;
    } else if (li < lcs.length && ni < newWords.length && newWords[ni] !== lcs[li]) {
      segments.push({ type: "insert", text: newWords[ni] });
      ni++;
    } else if (oi < oldWords.length) {
      segments.push({ type: "delete", text: oldWords[oi] });
      oi++;
    } else if (ni < newWords.length) {
      segments.push({ type: "insert", text: newWords[ni] });
      ni++;
    }
  }

  return mergeAdjacentSegments(segments);
}

/**
 * Summarize the differences between two message versions.
 */
export function summarizeEdit(oldText: string, newText: string): EditSummary {
  const diff = computeDiff(oldText, newText);

  let charsAdded = 0;
  let charsRemoved = 0;
  let wordsChanged = 0;

  for (const seg of diff) {
    if (seg.type === "insert") {
      charsAdded += seg.text.length;
      wordsChanged += seg.text.split(/\s+/).filter(Boolean).length;
    } else if (seg.type === "delete") {
      charsRemoved += seg.text.length;
      wordsChanged += seg.text.split(/\s+/).filter(Boolean).length;
    }
  }

  const totalChanged = charsAdded + charsRemoved;
  const isMinor = totalChanged < 10;

  let description: string;
  if (totalChanged === 0) {
    description = "No changes";
  } else if (charsRemoved === 0) {
    description = `Added ${charsAdded} character${charsAdded !== 1 ? "s" : ""}`;
  } else if (charsAdded === 0) {
    description = `Removed ${charsRemoved} character${charsRemoved !== 1 ? "s" : ""}`;
  } else {
    description = `Changed ${wordsChanged} word${wordsChanged !== 1 ? "s" : ""} (+${charsAdded}/-${charsRemoved})`;
  }

  return { charsAdded, charsRemoved, wordsChanged, isMinor, description };
}

/**
 * Format diff segments as a human-readable inline diff.
 * Deletions wrapped in [-...-], insertions in [+...+].
 */
export function formatInlineDiff(segments: DiffSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === "delete") return `[-${seg.text}-]`;
      if (seg.type === "insert") return `[+${seg.text}+]`;
      return seg.text;
    })
    .join("");
}

/**
 * Check if two texts are identical after whitespace normalization.
 */
export function isIdentical(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}

// ── Internal helpers ──

function tokenize(text: string): string[] {
  // Split on word boundaries, keeping whitespace as separate tokens
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function mergeAdjacentSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (last.type === segments[i].type) {
      last.text += segments[i].text;
    } else {
      merged.push({ ...segments[i] });
    }
  }
  return merged;
}
