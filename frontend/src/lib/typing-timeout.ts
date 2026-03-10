/** Typing indicator timeout management.
 *
 * Automatically clears stale typing indicators after a timeout,
 * preventing "ghost typing" when agents crash mid-response.
 */

export const DEFAULT_TYPING_TIMEOUT_MS = 30_000;

export interface TypingEntry {
  agentName: string;
  channelId: string;
  startedAt: number;
}

/**
 * Find entries that have exceeded the timeout.
 */
export function findStaleEntries(
  entries: TypingEntry[],
  now: number,
  timeoutMs = DEFAULT_TYPING_TIMEOUT_MS,
): TypingEntry[] {
  return entries.filter((e) => now - e.startedAt >= timeoutMs);
}

/**
 * Create a TypingEntry from agent/channel info.
 */
export function createTypingEntry(
  agentName: string,
  channelId: string,
): TypingEntry {
  return { agentName, channelId, startedAt: Date.now() };
}

/**
 * Check if an entry is stale.
 */
export function isStale(
  entry: TypingEntry,
  now: number,
  timeoutMs = DEFAULT_TYPING_TIMEOUT_MS,
): boolean {
  return now - entry.startedAt >= timeoutMs;
}
