/**
 * Channel online roster utilities.
 *
 * Tracks which members are currently active in a channel and provides
 * helpers for presence-aware channel views (who's here, who was recently active).
 */

export interface ChannelMember {
  userId: string;
  name: string;
  type: "human" | "agent";
  lastSeenAt: number; // epoch ms
}

export interface RosterSummary {
  online: ChannelMember[];
  away: ChannelMember[];
  offline: ChannelMember[];
  totalOnline: number;
  totalMembers: number;
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const AWAY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Classify a member's status based on last seen timestamp.
 */
export function classifyPresence(
  lastSeenAt: number,
  now: number = Date.now(),
  opts?: { onlineMs?: number; awayMs?: number }
): "online" | "away" | "offline" {
  const onlineMs = opts?.onlineMs ?? ONLINE_THRESHOLD_MS;
  const awayMs = opts?.awayMs ?? AWAY_THRESHOLD_MS;
  const elapsed = now - lastSeenAt;

  if (elapsed <= onlineMs) return "online";
  if (elapsed <= awayMs) return "away";
  return "offline";
}

/**
 * Build a roster summary for a channel's members.
 */
export function buildRoster(
  members: ChannelMember[],
  now: number = Date.now()
): RosterSummary {
  const online: ChannelMember[] = [];
  const away: ChannelMember[] = [];
  const offline: ChannelMember[] = [];

  for (const m of members) {
    const status = classifyPresence(m.lastSeenAt, now);
    if (status === "online") online.push(m);
    else if (status === "away") away.push(m);
    else offline.push(m);
  }

  // Sort each group by name
  const byName = (a: ChannelMember, b: ChannelMember) => a.name.localeCompare(b.name);
  online.sort(byName);
  away.sort(byName);
  offline.sort(byName);

  return {
    online,
    away,
    offline,
    totalOnline: online.length,
    totalMembers: members.length,
  };
}

/**
 * Format a presence indicator string for display.
 */
export function presenceIndicator(status: "online" | "away" | "offline"): string {
  switch (status) {
    case "online": return "🟢";
    case "away": return "🟡";
    case "offline": return "⚫";
  }
}

/**
 * Format a member list summary string like "Alice, Bob, and 3 others".
 */
export function formatMemberList(names: string[], maxShow: number = 3): string {
  if (names.length === 0) return "No one";
  if (names.length <= maxShow) {
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }
  const shown = names.slice(0, maxShow).join(", ");
  const remaining = names.length - maxShow;
  return `${shown}, and ${remaining} other${remaining > 1 ? "s" : ""}`;
}

/**
 * Get recently active members (within a time window), sorted by recency.
 */
export function recentlyActive(
  members: ChannelMember[],
  windowMs: number = 60 * 60 * 1000, // 1 hour
  now: number = Date.now()
): ChannelMember[] {
  return members
    .filter((m) => now - m.lastSeenAt <= windowMs)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
