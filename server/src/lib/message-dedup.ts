/**
 * Message duplicate detection utilities.
 *
 * Helps prevent accidental double-posts by detecting near-duplicate messages
 * within a configurable time window. Useful for both human typos and agent
 * retry storms.
 */

export interface DeduplicationOptions {
  /** Time window in milliseconds to check for duplicates (default: 60000 = 1 min) */
  windowMs?: number;
  /** Similarity threshold 0-1 (default: 1.0 = exact match only) */
  similarityThreshold?: number;
  /** Whether comparison is case-sensitive (default: false) */
  caseSensitive?: boolean;
}

export interface MessageEntry {
  id: string;
  content: string;
  senderId: string;
  channelId: string;
  createdAt: string;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  originalMessageId: string | null;
  similarity: number;
}

const DEFAULT_OPTIONS: Required<DeduplicationOptions> = {
  windowMs: 60_000,
  similarityThreshold: 1.0,
  caseSensitive: false,
};

/**
 * Normalize content for comparison — trims whitespace, optionally lowercases.
 */
export function normalizeContent(content: string, caseSensitive: boolean): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

/**
 * Calculate Jaccard similarity between two strings (word-level).
 * Returns 0-1 where 1 = identical word sets.
 */
export function jaccardSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Check if a message is a duplicate of any recent message from the same sender
 * in the same channel.
 */
export function checkDuplicate(
  candidate: { content: string; senderId: string; channelId: string },
  recentMessages: MessageEntry[],
  options?: DeduplicationOptions
): DuplicateResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = Date.now();
  const normalizedCandidate = normalizeContent(candidate.content, opts.caseSensitive);

  if (!normalizedCandidate) {
    return { isDuplicate: false, originalMessageId: null, similarity: 0 };
  }

  for (const msg of recentMessages) {
    // Must be same sender + same channel
    if (msg.senderId !== candidate.senderId || msg.channelId !== candidate.channelId) {
      continue;
    }

    // Must be within time window
    const msgTime = new Date(msg.createdAt).getTime();
    if (now - msgTime > opts.windowMs) {
      continue;
    }

    const normalizedExisting = normalizeContent(msg.content, opts.caseSensitive);
    const similarity = opts.similarityThreshold >= 1.0
      ? (normalizedCandidate === normalizedExisting ? 1 : 0)
      : jaccardSimilarity(normalizedCandidate, normalizedExisting);

    if (similarity >= opts.similarityThreshold) {
      return { isDuplicate: true, originalMessageId: msg.id, similarity };
    }
  }

  return { isDuplicate: false, originalMessageId: null, similarity: 0 };
}

/**
 * In-memory sliding window dedup store — lightweight alternative to querying DB.
 */
export class DedupStore {
  private entries: MessageEntry[] = [];
  private maxEntries: number;
  private windowMs: number;

  constructor(maxEntries = 500, windowMs = 60_000) {
    this.maxEntries = maxEntries;
    this.windowMs = windowMs;
  }

  /** Add a message to the store. */
  add(entry: MessageEntry): void {
    this.entries.push(entry);
    this.prune();
  }

  /** Check if a candidate message is a duplicate. */
  check(
    candidate: { content: string; senderId: string; channelId: string },
    options?: DeduplicationOptions
  ): DuplicateResult {
    this.prune();
    return checkDuplicate(candidate, this.entries, {
      windowMs: this.windowMs,
      ...options,
    });
  }

  /** Get current entry count. */
  get size(): number {
    return this.entries.length;
  }

  /** Remove entries outside the time window or exceeding max. */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.entries = this.entries.filter(
      (e) => new Date(e.createdAt).getTime() > cutoff
    );
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }
}
