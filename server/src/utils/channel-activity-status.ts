/**
 * Channel activity status utilities — classifies channels by their
 * recent activity level for UI indicators (e.g., green/yellow/gray dots).
 */

export type ActivityLevel = "active" | "moderate" | "quiet" | "inactive" | "dead";

export interface ActivityStatus {
  level: ActivityLevel;
  label: string;
  color: string;
  minutesSinceLastMessage: number | null;
}

/**
 * Classify a channel's activity level based on time since last message.
 */
export function classifyActivity(
  lastMessageAt: string | null | undefined,
  now: Date = new Date(),
): ActivityStatus {
  if (!lastMessageAt) {
    return {
      level: "dead",
      label: "No activity",
      color: "gray",
      minutesSinceLastMessage: null,
    };
  }

  const lastTime = new Date(lastMessageAt).getTime();
  if (isNaN(lastTime)) {
    return {
      level: "dead",
      label: "No activity",
      color: "gray",
      minutesSinceLastMessage: null,
    };
  }

  const minutes = Math.floor((now.getTime() - lastTime) / 60_000);

  if (minutes < 5) {
    return { level: "active", label: "Active now", color: "green", minutesSinceLastMessage: minutes };
  }
  if (minutes < 60) {
    return { level: "moderate", label: "Active recently", color: "yellow", minutesSinceLastMessage: minutes };
  }
  if (minutes < 1440) { // 24 hours
    return { level: "quiet", label: "Quiet today", color: "orange", minutesSinceLastMessage: minutes };
  }
  if (minutes < 10080) { // 7 days
    return { level: "inactive", label: "Inactive this week", color: "red", minutesSinceLastMessage: minutes };
  }
  return { level: "dead", label: "No recent activity", color: "gray", minutesSinceLastMessage: minutes };
}

/**
 * Get just the activity level (for simple comparisons).
 */
export function getActivityLevel(lastMessageAt: string | null | undefined): ActivityLevel {
  return classifyActivity(lastMessageAt).level;
}

/**
 * Sort channels by activity level (most active first).
 */
export function sortByActivity<T extends { lastMessageAt?: string | null }>(
  channels: T[],
): T[] {
  const levels: Record<ActivityLevel, number> = {
    active: 0,
    moderate: 1,
    quiet: 2,
    inactive: 3,
    dead: 4,
  };
  return [...channels].sort((a, b) => {
    const aLevel = levels[getActivityLevel(a.lastMessageAt)];
    const bLevel = levels[getActivityLevel(b.lastMessageAt)];
    return aLevel - bLevel;
  });
}

/**
 * Get an emoji indicator for the activity level.
 */
export function activityEmoji(level: ActivityLevel): string {
  const emojis: Record<ActivityLevel, string> = {
    active: "🟢",
    moderate: "🟡",
    quiet: "🟠",
    inactive: "🔴",
    dead: "⚫",
  };
  return emojis[level];
}

/**
 * Format activity as a human-readable string.
 */
export function formatActivity(lastMessageAt: string | null | undefined): string {
  const status = classifyActivity(lastMessageAt);
  return `${activityEmoji(status.level)} ${status.label}`;
}
