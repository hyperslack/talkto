/**
 * Message trash/recycle bin — soft-delete support.
 *
 * Stores deleted messages in memory for recovery within a retention period.
 * Messages are auto-purged after 24 hours.
 */

export interface TrashedMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  mentions: string | null;
  parentId: string | null;
  createdAt: string;
  deletedAt: string;
  deletedBy: string;
}

// In-memory trash store
export const trash = new Map<string, TrashedMessage>();

const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Move a message to trash */
export function trashMessage(msg: {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  mentions: string | null;
  parentId: string | null;
  createdAt: string;
}, deletedBy: string): void {
  trash.set(msg.id, {
    ...msg,
    deletedAt: new Date().toISOString(),
    deletedBy,
  });
}

/** Restore a message from trash. Returns the message or null. */
export function restoreFromTrash(messageId: string): TrashedMessage | null {
  const msg = trash.get(messageId);
  if (!msg) return null;
  trash.delete(messageId);
  return msg;
}

/** List trashed messages for a channel */
export function listTrash(channelId?: string): TrashedMessage[] {
  const items = Array.from(trash.values());
  if (channelId) return items.filter((m) => m.channelId === channelId);
  return items;
}

/** Purge expired messages from trash */
export function purgeExpiredTrash(): number {
  const cutoff = Date.now() - RETENTION_MS;
  let purged = 0;
  for (const [id, msg] of trash) {
    if (new Date(msg.deletedAt).getTime() < cutoff) {
      trash.delete(id);
      purged++;
    }
  }
  return purged;
}

/** Clear all trash (for testing) */
export function clearTrash(): void {
  trash.clear();
}
