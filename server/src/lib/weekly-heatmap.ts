/**
 * Weekly activity heatmap utilities.
 *
 * Produces a 7×24 grid of message counts (day-of-week × hour-of-day)
 * for visualization as a heatmap. Useful for understanding when a
 * workspace or channel is most active.
 */

export interface HeatmapCell {
  day: number;       // 0 = Sunday, 6 = Saturday
  dayName: string;
  hour: number;      // 0-23
  count: number;
}

export interface HeatmapSummary {
  grid: HeatmapCell[];
  peakDay: number;
  peakHour: number;
  peakCount: number;
  totalMessages: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Build a 7×24 heatmap from message timestamps.
 */
export function buildHeatmap(timestamps: string[]): HeatmapSummary {
  // Initialize 7×24 grid
  const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const ts of timestamps) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    counts[d.getDay()][d.getHours()]++;
  }

  let peakDay = 0;
  let peakHour = 0;
  let peakCount = 0;
  let totalMessages = 0;

  const grid: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = counts[day][hour];
      totalMessages += count;
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
        peakHour = hour;
      }
      grid.push({ day, dayName: DAY_NAMES[day], hour, count });
    }
  }

  return { grid, peakDay, peakHour, peakCount, totalMessages };
}

/**
 * Get the busiest day of the week from a heatmap.
 */
export function busiestDay(heatmap: HeatmapSummary): { day: number; dayName: string; count: number } {
  const dayCounts = Array(7).fill(0);
  for (const cell of heatmap.grid) {
    dayCounts[cell.day] += cell.count;
  }
  let maxDay = 0;
  for (let i = 1; i < 7; i++) {
    if (dayCounts[i] > dayCounts[maxDay]) maxDay = i;
  }
  return { day: maxDay, dayName: DAY_NAMES[maxDay], count: dayCounts[maxDay] };
}

/**
 * Get the quietest day of the week from a heatmap.
 */
export function quietestDay(heatmap: HeatmapSummary): { day: number; dayName: string; count: number } {
  const dayCounts = Array(7).fill(0);
  for (const cell of heatmap.grid) {
    dayCounts[cell.day] += cell.count;
  }
  let minDay = 0;
  for (let i = 1; i < 7; i++) {
    if (dayCounts[i] < dayCounts[minDay]) minDay = i;
  }
  return { day: minDay, dayName: DAY_NAMES[minDay], count: dayCounts[minDay] };
}

/**
 * Format a heatmap cell count into a visual intensity level (0-4).
 */
export function intensityLevel(count: number, maxCount: number): number {
  if (maxCount === 0 || count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
