/**
 * Channel freeze — temporarily prevent all new messages in a channel.
 *
 * Unlike read-only (admin-only posting) or archive (hidden), freeze is a
 * temporary lock that blocks ALL messages including from admins and agents.
 * Useful during maintenance, moderation, or controlled discussions.
 */

export interface FreezeInfo {
  channelId: string;
  frozenAt: string;
  frozenBy: string;
  reason?: string;
  expiresAt?: string; // auto-unfreeze after this time
}

// channelId → FreezeInfo
export const frozenChannels = new Map<string, FreezeInfo>();

/** Freeze a channel */
export function freezeChannel(
  channelId: string,
  frozenBy: string,
  reason?: string,
  durationMs?: number
): FreezeInfo {
  const now = new Date();
  const info: FreezeInfo = {
    channelId,
    frozenAt: now.toISOString(),
    frozenBy,
    reason,
    expiresAt: durationMs ? new Date(now.getTime() + durationMs).toISOString() : undefined,
  };
  frozenChannels.set(channelId, info);
  return info;
}

/** Unfreeze a channel */
export function unfreezeChannel(channelId: string): boolean {
  return frozenChannels.delete(channelId);
}

/** Check if a channel is frozen (auto-expires if past expiresAt) */
export function isChannelFrozen(channelId: string): FreezeInfo | null {
  const info = frozenChannels.get(channelId);
  if (!info) return null;

  // Auto-expire
  if (info.expiresAt && new Date(info.expiresAt) <= new Date()) {
    frozenChannels.delete(channelId);
    return null;
  }

  return info;
}

/** List all frozen channels */
export function listFrozenChannels(): FreezeInfo[] {
  // Clean up expired first
  for (const [id, info] of frozenChannels) {
    if (info.expiresAt && new Date(info.expiresAt) <= new Date()) {
      frozenChannels.delete(id);
    }
  }
  return Array.from(frozenChannels.values());
}

/** Clear all freezes (for testing) */
export function clearAllFreezes(): void {
  frozenChannels.clear();
}
