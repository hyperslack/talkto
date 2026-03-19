/**
 * Typing indicator state machine — manages typing state per channel with
 * automatic timeout, debouncing, and formatting for "X is typing…" UI.
 */

export interface TypingEntry {
  userName: string;
  userType: "human" | "agent";
  channelId: string;
  startedAt: number; // Date.now()
  expiresAt: number;
}

/** Default typing indicator timeout: 8 seconds. */
const DEFAULT_TIMEOUT_MS = 8_000;

export class TypingStateManager {
  private entries = new Map<string, TypingEntry>(); // key: `channelId:userName`
  private timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  private key(channelId: string, userName: string): string {
    return `${channelId}:${userName}`;
  }

  /**
   * Mark a user as typing in a channel.
   */
  startTyping(channelId: string, userName: string, userType: "human" | "agent"): void {
    const now = Date.now();
    this.entries.set(this.key(channelId, userName), {
      userName,
      userType,
      channelId,
      startedAt: now,
      expiresAt: now + this.timeoutMs,
    });
  }

  /**
   * Clear typing state for a user in a channel.
   */
  stopTyping(channelId: string, userName: string): void {
    this.entries.delete(this.key(channelId, userName));
  }

  /**
   * Get all active typing users in a channel (excluding expired).
   */
  getTyping(channelId: string, now: number = Date.now()): TypingEntry[] {
    this.pruneExpired(now);
    const result: TypingEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.channelId === channelId) {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Get typing user names in a channel.
   */
  getTypingNames(channelId: string, now: number = Date.now()): string[] {
    return this.getTyping(channelId, now).map((e) => e.userName);
  }

  /**
   * Check if anyone is typing in a channel.
   */
  isAnyoneTyping(channelId: string, now: number = Date.now()): boolean {
    return this.getTyping(channelId, now).length > 0;
  }

  /**
   * Format the typing indicator text (e.g., "Alice is typing…").
   */
  formatTypingText(channelId: string, now: number = Date.now()): string | null {
    const names = this.getTypingNames(channelId, now);
    return formatTypingNames(names);
  }

  /**
   * Remove all expired entries.
   */
  pruneExpired(now: number = Date.now()): number {
    let pruned = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Clear all typing state.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Total active entries across all channels.
   */
  get size(): number {
    return this.entries.size;
  }
}

/**
 * Format an array of typing user names into display text.
 */
export function formatTypingNames(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing…`;
}
