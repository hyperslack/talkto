/**
 * Workspace announcement banner utilities.
 *
 * Manages pinned announcements that appear at the top of the workspace,
 * with support for expiry, dismissal tracking, and priority levels.
 */

export type AnnouncementLevel = "info" | "warning" | "critical";

export interface Announcement {
  id: string;
  text: string;
  level: AnnouncementLevel;
  createdBy: string;
  createdAt: number; // epoch ms
  expiresAt: number | null; // epoch ms, null = never
  dismissible: boolean;
}

export interface AnnouncementStore {
  announcements: Map<string, Announcement>;
  dismissals: Map<string, Set<string>>; // announcementId → set of userIds
}

/**
 * Create a new announcement store.
 */
export function createStore(): AnnouncementStore {
  return {
    announcements: new Map(),
    dismissals: new Map(),
  };
}

/**
 * Add an announcement to the store.
 */
export function addAnnouncement(
  store: AnnouncementStore,
  announcement: Announcement
): void {
  store.announcements.set(announcement.id, announcement);
}

/**
 * Remove an announcement from the store.
 */
export function removeAnnouncement(store: AnnouncementStore, id: string): boolean {
  store.dismissals.delete(id);
  return store.announcements.delete(id);
}

/**
 * Check if an announcement has expired.
 */
export function isExpired(announcement: Announcement, now: number = Date.now()): boolean {
  return announcement.expiresAt !== null && now >= announcement.expiresAt;
}

/**
 * Dismiss an announcement for a specific user.
 */
export function dismiss(store: AnnouncementStore, announcementId: string, userId: string): boolean {
  const ann = store.announcements.get(announcementId);
  if (!ann || !ann.dismissible) return false;

  if (!store.dismissals.has(announcementId)) {
    store.dismissals.set(announcementId, new Set());
  }
  store.dismissals.get(announcementId)!.add(userId);
  return true;
}

/**
 * Check if a user has dismissed an announcement.
 */
export function isDismissed(store: AnnouncementStore, announcementId: string, userId: string): boolean {
  return store.dismissals.get(announcementId)?.has(userId) ?? false;
}

/**
 * Get all active (non-expired, non-dismissed) announcements for a user,
 * sorted by priority (critical > warning > info) then by creation date (newest first).
 */
export function getActiveAnnouncements(
  store: AnnouncementStore,
  userId: string,
  now: number = Date.now()
): Announcement[] {
  const levelOrder: Record<AnnouncementLevel, number> = { critical: 0, warning: 1, info: 2 };

  return Array.from(store.announcements.values())
    .filter((a) => !isExpired(a, now) && !isDismissed(store, a.id, userId))
    .sort((a, b) => {
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return b.createdAt - a.createdAt;
    });
}

/**
 * Purge all expired announcements from the store.
 */
export function purgeExpired(store: AnnouncementStore, now: number = Date.now()): number {
  let purged = 0;
  for (const [id, ann] of store.announcements) {
    if (isExpired(ann, now)) {
      store.announcements.delete(id);
      store.dismissals.delete(id);
      purged++;
    }
  }
  return purged;
}

/**
 * Get the level badge emoji for display.
 */
export function levelBadge(level: AnnouncementLevel): string {
  switch (level) {
    case "critical": return "🔴";
    case "warning": return "🟡";
    case "info": return "🔵";
  }
}
