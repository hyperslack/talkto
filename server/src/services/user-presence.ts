/**
 * Human user online status tracking.
 *
 * Tracks online/away/offline status for human users.
 * Status is updated on WebSocket connect/disconnect and activity.
 */

export type PresenceStatus = "online" | "away" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_active_at: string;
  status_text: string | null;
}

// In-memory presence store (fast, no DB needed — ephemeral by nature)
const presenceStore = new Map<string, UserPresence>();

// Away timeout: mark as "away" after 5 minutes of inactivity
const AWAY_TIMEOUT_MS = 5 * 60 * 1000;

/** Set a user as online (e.g., on WebSocket connect or activity). */
export function setOnline(userId: string, statusText?: string | null): UserPresence {
  const now = new Date().toISOString();
  const presence: UserPresence = {
    user_id: userId,
    status: "online",
    last_active_at: now,
    status_text: statusText ?? presenceStore.get(userId)?.status_text ?? null,
  };
  presenceStore.set(userId, presence);
  return presence;
}

/** Set a user as offline (e.g., on WebSocket disconnect). */
export function setOffline(userId: string): UserPresence {
  const now = new Date().toISOString();
  const existing = presenceStore.get(userId);
  const presence: UserPresence = {
    user_id: userId,
    status: "offline",
    last_active_at: now,
    status_text: existing?.status_text ?? null,
  };
  presenceStore.set(userId, presence);
  return presence;
}

/** Set a user as away. */
export function setAway(userId: string): UserPresence {
  const now = new Date().toISOString();
  const existing = presenceStore.get(userId);
  const presence: UserPresence = {
    user_id: userId,
    status: "away",
    last_active_at: existing?.last_active_at ?? now,
    status_text: existing?.status_text ?? null,
  };
  presenceStore.set(userId, presence);
  return presence;
}

/** Update status text for a user. */
export function setStatusText(userId: string, text: string | null): void {
  const existing = presenceStore.get(userId);
  if (existing) {
    existing.status_text = text;
  }
}

/** Get presence for a user. Returns offline if unknown. */
export function getPresence(userId: string): UserPresence {
  return presenceStore.get(userId) ?? {
    user_id: userId,
    status: "offline",
    last_active_at: new Date().toISOString(),
    status_text: null,
  };
}

/** Get presence for all tracked users. */
export function getAllPresence(): UserPresence[] {
  return Array.from(presenceStore.values());
}

/** Get online user count. */
export function getOnlineCount(): number {
  return Array.from(presenceStore.values()).filter((p) => p.status === "online").length;
}

/**
 * Check all online users and mark as "away" if inactive for > AWAY_TIMEOUT_MS.
 * Call this periodically (e.g., every 60 seconds).
 */
export function checkAwayStatus(): string[] {
  const now = Date.now();
  const markedAway: string[] = [];

  for (const [userId, presence] of presenceStore) {
    if (presence.status === "online") {
      const lastActive = new Date(presence.last_active_at).getTime();
      if (now - lastActive > AWAY_TIMEOUT_MS) {
        presence.status = "away";
        markedAway.push(userId);
      }
    }
  }

  return markedAway;
}

/** Clear all presence data (for testing). */
export function clearPresence(): void {
  presenceStore.clear();
}
