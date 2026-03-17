/**
 * Workspace analytics aggregation — compute workspace-level metrics.
 *
 * Aggregates message volume, user activity, channel health,
 * and growth trends from raw event data.
 */

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  messageCount: number;
  activeUsers: number;
  activeChannels: number;
}

export interface GrowthTrend {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface WorkspaceMetrics {
  totalMessages: number;
  totalActiveUsers: number;
  totalActiveChannels: number;
  avgMessagesPerDay: number;
  peakDay: DailyMetric | null;
  quietestDay: DailyMetric | null;
}

/** Compute aggregate metrics from daily data. */
export function computeMetrics(dailyData: DailyMetric[]): WorkspaceMetrics {
  if (dailyData.length === 0) {
    return { totalMessages: 0, totalActiveUsers: 0, totalActiveChannels: 0, avgMessagesPerDay: 0, peakDay: null, quietestDay: null };
  }

  let totalMessages = 0;
  const allUsers = new Set<number>(); // tracking unique counts
  const allChannels = new Set<number>();
  let peak: DailyMetric = dailyData[0];
  let quietest: DailyMetric = dailyData[0];

  for (const d of dailyData) {
    totalMessages += d.messageCount;
    if (d.messageCount > peak.messageCount) peak = d;
    if (d.messageCount < quietest.messageCount) quietest = d;
  }

  // For unique users/channels, sum the max seen
  const maxActiveUsers = Math.max(...dailyData.map((d) => d.activeUsers));
  const maxActiveChannels = Math.max(...dailyData.map((d) => d.activeChannels));

  return {
    totalMessages,
    totalActiveUsers: maxActiveUsers,
    totalActiveChannels: maxActiveChannels,
    avgMessagesPerDay: Math.round(totalMessages / dailyData.length),
    peakDay: peak,
    quietestDay: quietest,
  };
}

/** Compute growth trend comparing two periods. */
export function computeTrend(current: number, previous: number): GrowthTrend {
  const change = current - previous;
  const changePercent = previous > 0 ? Math.round((change / previous) * 100) : current > 0 ? 100 : 0;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return { current, previous, change, changePercent, direction };
}

/** Format a trend as a display string. */
export function formatTrend(trend: GrowthTrend): string {
  const arrow = trend.direction === "up" ? "📈" : trend.direction === "down" ? "📉" : "➡️";
  const sign = trend.change >= 0 ? "+" : "";
  return `${arrow} ${sign}${trend.change} (${sign}${trend.changePercent}%)`;
}

/** Split daily data into weeks. */
export function splitIntoWeeks(dailyData: DailyMetric[]): DailyMetric[][] {
  const sorted = [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
  const weeks: DailyMetric[][] = [];
  for (let i = 0; i < sorted.length; i += 7) {
    weeks.push(sorted.slice(i, i + 7));
  }
  return weeks;
}

/** Get the N most active days. */
export function topActiveDays(dailyData: DailyMetric[], limit: number = 5): DailyMetric[] {
  return [...dailyData].sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
}

/** Compute day-over-day message growth rates. */
export function dailyGrowthRates(dailyData: DailyMetric[]): { date: string; rate: number }[] {
  const sorted = [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
  const rates: { date: string; rate: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].messageCount;
    const rate = prev > 0 ? Math.round(((sorted[i].messageCount - prev) / prev) * 100) : 0;
    rates.push({ date: sorted[i].date, rate });
  }
  return rates;
}
