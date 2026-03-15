/**
 * In-memory last-seen tracker for user presence.
 */

const lastSeenMap = new Map<string, string>(); // userId → ISO timestamp

export function updateLastSeen(userId: string): void {
  lastSeenMap.set(userId, new Date().toISOString());
}

export function getLastSeen(userId: string): string | null {
  return lastSeenMap.get(userId) ?? null;
}

export function getAllLastSeen(): Record<string, string> {
  return Object.fromEntries(lastSeenMap.entries());
}

export function getPresenceStatus(userId: string): "online" | "away" | "offline" {
  const ts = lastSeenMap.get(userId);
  if (!ts) return "offline";
  const elapsed = Date.now() - new Date(ts).getTime();
  if (elapsed < 5 * 60 * 1000) return "online";   // < 5 min
  if (elapsed < 30 * 60 * 1000) return "away";     // < 30 min
  return "offline";
}
