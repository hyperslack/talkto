/**
 * User activity streak tracking — computes consecutive-day activity
 * streaks from message timestamps for gamification and engagement.
 */

export interface StreakInfo {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  isActiveToday: boolean;
}

/**
 * Compute streak info from a list of message timestamps for a user.
 * Timestamps should be ISO 8601 strings.
 */
export function computeStreak(userId: string, timestamps: string[], today?: string): StreakInfo {
  if (timestamps.length === 0) {
    return { userId, currentStreak: 0, longestStreak: 0, totalActiveDays: 0, lastActiveDate: null, isActiveToday: false };
  }

  const todayDate = today ?? toDateString(new Date().toISOString());
  const activeDays = getUniqueDays(timestamps).sort();
  const totalActiveDays = activeDays.length;
  const lastActiveDate = activeDays[activeDays.length - 1];
  const isActiveToday = lastActiveDate === todayDate;

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < activeDays.length; i++) {
    if (isConsecutiveDay(activeDays[i - 1], activeDays[i])) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // Current streak: count back from last active day
  let currentStreak = 1;
  for (let i = activeDays.length - 2; i >= 0; i--) {
    if (isConsecutiveDay(activeDays[i], activeDays[i + 1])) {
      currentStreak++;
    } else {
      break;
    }
  }

  // If the user hasn't been active today or yesterday, streak is broken
  const yesterday = addDays(todayDate, -1);
  if (lastActiveDate !== todayDate && lastActiveDate !== yesterday) {
    currentStreak = 0;
  }

  return { userId, currentStreak, longestStreak, totalActiveDays, lastActiveDate, isActiveToday };
}

/**
 * Format a streak for display with emoji.
 */
export function formatStreak(streak: StreakInfo): string {
  if (streak.currentStreak === 0) return "No active streak";
  const fire = streak.currentStreak >= 7 ? "🔥" : streak.currentStreak >= 3 ? "⚡" : "✨";
  return `${fire} ${streak.currentStreak}-day streak (best: ${streak.longestStreak})`;
}

/**
 * Get a milestone label if the streak has hit a notable number.
 */
export function getStreakMilestone(days: number): string | null {
  if (days === 7) return "🎯 One week streak!";
  if (days === 14) return "💪 Two week streak!";
  if (days === 30) return "🏆 One month streak!";
  if (days === 100) return "💯 100-day streak!";
  if (days === 365) return "👑 One year streak!";
  return null;
}

/**
 * Check if a streak is at risk (active yesterday but not today).
 */
export function isStreakAtRisk(streak: StreakInfo, today?: string): boolean {
  if (streak.currentStreak === 0) return false;
  const todayDate = today ?? toDateString(new Date().toISOString());
  return !streak.isActiveToday && streak.lastActiveDate === addDays(todayDate, -1);
}

// ── Internal helpers ──

function toDateString(iso: string): string {
  return iso.slice(0, 10);
}

function getUniqueDays(timestamps: string[]): string[] {
  const days = new Set(timestamps.map(toDateString));
  return [...days];
}

function isConsecutiveDay(a: string, b: string): boolean {
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  const diff = dateB.getTime() - dateA.getTime();
  return diff === 86400000; // exactly 1 day
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
