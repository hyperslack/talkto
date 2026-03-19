/**
 * Unread state tracker — client-side unread count management per channel.
 * Tracks last-read timestamps and computes unread counts from incoming messages.
 */

export interface UnreadState {
  channelId: string;
  unreadCount: number;
  hasMention: boolean;
  lastReadAt: string | null;   // ISO timestamp
  lastMessageAt: string | null;
}

export class UnreadTracker {
  private states = new Map<string, UnreadState>();

  /**
   * Initialize a channel's unread state.
   */
  initChannel(channelId: string, lastReadAt: string | null = null): void {
    if (!this.states.has(channelId)) {
      this.states.set(channelId, {
        channelId,
        unreadCount: 0,
        hasMention: false,
        lastReadAt,
        lastMessageAt: null,
      });
    }
  }

  /**
   * Record a new message arriving in a channel.
   * Increments unread count if the message is after lastReadAt.
   */
  onMessage(
    channelId: string,
    messageTimestamp: string,
    isMention: boolean = false,
    isOwnMessage: boolean = false,
  ): void {
    const state = this.getOrCreate(channelId);
    state.lastMessageAt = messageTimestamp;

    // Own messages don't count as unread
    if (isOwnMessage) {
      state.lastReadAt = messageTimestamp;
      return;
    }

    // If we have a lastReadAt, only count messages after it
    if (state.lastReadAt) {
      const readTime = new Date(state.lastReadAt).getTime();
      const msgTime = new Date(messageTimestamp).getTime();
      if (msgTime <= readTime) return;
    }

    state.unreadCount++;
    if (isMention) state.hasMention = true;
  }

  /**
   * Mark a channel as read (resets unread count).
   */
  markRead(channelId: string, timestamp?: string): void {
    const state = this.getOrCreate(channelId);
    state.unreadCount = 0;
    state.hasMention = false;
    state.lastReadAt = timestamp ?? new Date().toISOString();
  }

  /**
   * Mark all channels as read.
   */
  markAllRead(): void {
    const now = new Date().toISOString();
    for (const state of this.states.values()) {
      state.unreadCount = 0;
      state.hasMention = false;
      state.lastReadAt = now;
    }
  }

  /**
   * Get unread state for a channel.
   */
  getState(channelId: string): UnreadState | null {
    return this.states.get(channelId) ?? null;
  }

  /**
   * Get unread count for a channel.
   */
  getUnreadCount(channelId: string): number {
    return this.states.get(channelId)?.unreadCount ?? 0;
  }

  /**
   * Check if a channel has unread messages.
   */
  hasUnread(channelId: string): boolean {
    return this.getUnreadCount(channelId) > 0;
  }

  /**
   * Get total unread count across all channels.
   */
  getTotalUnread(): number {
    let total = 0;
    for (const state of this.states.values()) {
      total += state.unreadCount;
    }
    return total;
  }

  /**
   * Get channels with unread messages, sorted by count descending.
   */
  getUnreadChannels(): UnreadState[] {
    return [...this.states.values()]
      .filter((s) => s.unreadCount > 0)
      .sort((a, b) => b.unreadCount - a.unreadCount);
  }

  /**
   * Get channels with mentions (highest priority).
   */
  getMentionChannels(): UnreadState[] {
    return [...this.states.values()].filter((s) => s.hasMention);
  }

  /**
   * Format unread count for badge display (caps at 99+).
   */
  formatBadge(channelId: string): string | null {
    const count = this.getUnreadCount(channelId);
    if (count === 0) return null;
    if (count > 99) return "99+";
    return String(count);
  }

  /**
   * Remove tracking for a channel (e.g., on channel delete).
   */
  removeChannel(channelId: string): void {
    this.states.delete(channelId);
  }

  /**
   * Number of tracked channels.
   */
  get size(): number {
    return this.states.size;
  }

  private getOrCreate(channelId: string): UnreadState {
    if (!this.states.has(channelId)) {
      this.initChannel(channelId);
    }
    return this.states.get(channelId)!;
  }
}
