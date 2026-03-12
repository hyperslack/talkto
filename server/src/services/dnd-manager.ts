/**
 * Do-Not-Disturb manager — lets users mute all notifications for a duration.
 *
 * In-memory store (resets on restart). Provides helpers to check DND status
 * and schedule auto-expiry.
 */

export interface DndEntry {
  userId: string;
  enabledAt: string; // ISO 8601
  expiresAt: string | null; // null = indefinite
}

const store = new Map<string, DndEntry>();

/** Enable DND for a user. durationMinutes=0 means indefinite. */
export function enableDnd(userId: string, durationMinutes: number = 0): DndEntry {
  const now = new Date();
  const entry: DndEntry = {
    userId,
    enabledAt: now.toISOString(),
    expiresAt:
      durationMinutes > 0
        ? new Date(now.getTime() + durationMinutes * 60_000).toISOString()
        : null,
  };
  store.set(userId, entry);
  return entry;
}

/** Disable DND for a user. */
export function disableDnd(userId: string): boolean {
  return store.delete(userId);
}

/** Check if a user currently has DND active. Automatically clears expired entries. */
export function isDnd(userId: string): boolean {
  const entry = store.get(userId);
  if (!entry) return false;
  if (entry.expiresAt && new Date(entry.expiresAt) <= new Date()) {
    store.delete(userId);
    return false;
  }
  return true;
}

/** Get DND details for a user, or null if not in DND. */
export function getDndStatus(userId: string): DndEntry | null {
  if (!isDnd(userId)) return null;
  return store.get(userId) ?? null;
}

/** Get all users currently in DND (purges expired). */
export function listDndUsers(): DndEntry[] {
  const result: DndEntry[] = [];
  for (const [userId, entry] of store) {
    if (entry.expiresAt && new Date(entry.expiresAt) <= new Date()) {
      store.delete(userId);
    } else {
      result.push(entry);
    }
  }
  return result;
}

/** Calculate remaining minutes of DND (0 if indefinite, -1 if not active). */
export function remainingMinutes(userId: string): number {
  const entry = store.get(userId);
  if (!entry) return -1;
  if (!entry.expiresAt) return 0; // indefinite
  const remaining = (new Date(entry.expiresAt).getTime() - Date.now()) / 60_000;
  if (remaining <= 0) {
    store.delete(userId);
    return -1;
  }
  return Math.ceil(remaining);
}

/** Clear all DND entries (for testing). */
export function clearAll(): void {
  store.clear();
}
