/**
 * Agent response time tracking utilities.
 *
 * Tracks and computes statistics on how long agents take to respond,
 * enabling latency monitoring and performance comparison.
 */

export interface ResponseTimeSample {
  agentId: string;
  durationMs: number;
  timestamp: number;
}

export interface ResponseTimeStats {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  medianMs: number;
  p95Ms: number;
}

/**
 * In-memory tracker for agent response times.
 * Bounded by maxSamples per agent to prevent memory leaks.
 */
export class AgentResponseTimeTracker {
  private samples = new Map<string, ResponseTimeSample[]>();
  private maxSamples: number;

  constructor(maxSamples = 100) {
    this.maxSamples = maxSamples;
  }

  /** Record a response time for an agent. */
  record(agentId: string, durationMs: number): void {
    if (durationMs < 0) return;
    const list = this.samples.get(agentId) ?? [];
    list.push({ agentId, durationMs, timestamp: Date.now() });
    if (list.length > this.maxSamples) list.shift();
    this.samples.set(agentId, list);
  }

  /** Get all samples for an agent. */
  getSamples(agentId: string): ResponseTimeSample[] {
    return this.samples.get(agentId) ?? [];
  }

  /** Compute stats for an agent. Returns null if no samples. */
  getStats(agentId: string): ResponseTimeStats | null {
    const list = this.samples.get(agentId);
    if (!list || list.length === 0) return null;
    return computeStats(list.map((s) => s.durationMs));
  }

  /** Get stats for all tracked agents. */
  getAllStats(): Map<string, ResponseTimeStats> {
    const result = new Map<string, ResponseTimeStats>();
    for (const [agentId] of this.samples) {
      const stats = this.getStats(agentId);
      if (stats) result.set(agentId, stats);
    }
    return result;
  }

  /** Get the fastest agent by average response time. */
  getFastest(): { agentId: string; avgMs: number } | null {
    let best: { agentId: string; avgMs: number } | null = null;
    for (const [agentId] of this.samples) {
      const stats = this.getStats(agentId);
      if (stats && (!best || stats.avgMs < best.avgMs)) {
        best = { agentId, avgMs: stats.avgMs };
      }
    }
    return best;
  }

  /** Get the slowest agent by average response time. */
  getSlowest(): { agentId: string; avgMs: number } | null {
    let worst: { agentId: string; avgMs: number } | null = null;
    for (const [agentId] of this.samples) {
      const stats = this.getStats(agentId);
      if (stats && (!worst || stats.avgMs > worst.avgMs)) {
        worst = { agentId, avgMs: stats.avgMs };
      }
    }
    return worst;
  }

  /** List all tracked agent IDs. */
  trackedAgents(): string[] {
    return [...this.samples.keys()];
  }

  /** Clear samples for an agent. */
  clear(agentId: string): void {
    this.samples.delete(agentId);
  }

  /** Clear all samples. */
  clearAll(): void {
    this.samples.clear();
  }

  /** Get sample count for an agent. */
  sampleCount(agentId: string): number {
    return (this.samples.get(agentId) ?? []).length;
  }
}

/** Compute stats from an array of durations. */
export function computeStats(durations: number[]): ResponseTimeStats {
  const sorted = [...durations].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count,
    avgMs: Math.round(sum / count),
    minMs: sorted[0],
    maxMs: sorted[count - 1],
    medianMs: sorted[Math.floor(count / 2)],
    p95Ms: sorted[Math.floor(count * 0.95)],
  };
}

/** Format duration in human-readable form. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
