/**
 * Message deduplication utilities.
 *
 * Detects and filters duplicate messages based on content similarity,
 * timing, and sender identity. Useful for preventing duplicate submissions
 * and cleaning up message feeds.
 */

export interface DeduplicableMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface DuplicateGroup {
  original: DeduplicableMessage;
  duplicates: DeduplicableMessage[];
}

/**
 * Check if two messages are likely duplicates.
 * Same sender, same content, within timeWindowMs.
 */
export function isDuplicate(
  a: DeduplicableMessage,
  b: DeduplicableMessage,
  timeWindowMs = 5000
): boolean {
  if (a.id === b.id) return false; // same message
  if (a.sender_id !== b.sender_id) return false;
  if (a.content !== b.content) return false;
  const diff = Math.abs(
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return diff <= timeWindowMs;
}

/**
 * Remove duplicate messages from an array, keeping the earliest.
 */
export function deduplicateMessages(
  messages: DeduplicableMessage[],
  timeWindowMs = 5000
): DeduplicableMessage[] {
  const result: DeduplicableMessage[] = [];
  for (const msg of messages) {
    const isDup = result.some((existing) =>
      isDuplicate(existing, msg, timeWindowMs)
    );
    if (!isDup) result.push(msg);
  }
  return result;
}

/**
 * Find all duplicate groups in a message array.
 */
export function findDuplicateGroups(
  messages: DeduplicableMessage[],
  timeWindowMs = 5000
): DuplicateGroup[] {
  const used = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (used.has(messages[i].id)) continue;
    const dupes: DeduplicableMessage[] = [];
    for (let j = i + 1; j < messages.length; j++) {
      if (used.has(messages[j].id)) continue;
      if (isDuplicate(messages[i], messages[j], timeWindowMs)) {
        dupes.push(messages[j]);
        used.add(messages[j].id);
      }
    }
    if (dupes.length > 0) {
      used.add(messages[i].id);
      groups.push({ original: messages[i], duplicates: dupes });
    }
  }
  return groups;
}

/**
 * Count total duplicates in a message array.
 */
export function countDuplicates(
  messages: DeduplicableMessage[],
  timeWindowMs = 5000
): number {
  const deduped = deduplicateMessages(messages, timeWindowMs);
  return messages.length - deduped.length;
}

/**
 * Simple content fingerprint for fast comparison.
 * Normalizes whitespace and lowercases.
 */
export function contentFingerprint(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Check if content is similar (ignoring whitespace/case differences).
 */
export function isSimilarContent(a: string, b: string): boolean {
  return contentFingerprint(a) === contentFingerprint(b);
}

/**
 * In-memory sliding-window dedup guard.
 * Tracks recent message fingerprints to reject duplicates at submission time.
 */
export class DedupGuard {
  private recent = new Map<string, number>(); // fingerprint -> timestamp
  private windowMs: number;

  constructor(windowMs = 5000) {
    this.windowMs = windowMs;
  }

  /** Returns true if this is a duplicate (should be rejected). */
  check(senderId: string, content: string): boolean {
    this.prune();
    const key = `${senderId}:${contentFingerprint(content)}`;
    if (this.recent.has(key)) return true;
    this.recent.set(key, Date.now());
    return false;
  }

  /** Remove expired entries. */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, ts] of this.recent) {
      if (ts < cutoff) this.recent.delete(key);
    }
  }

  /** Clear all tracked entries. */
  clear(): void {
    this.recent.clear();
  }

  /** Current number of tracked entries. */
  size(): number {
    this.prune();
    return this.recent.size;
  }
}
