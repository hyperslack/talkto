/**
 * Agent status history tracker — tracks online/offline transitions.
 *
 * Maintains a bounded history of agent status changes for uptime
 * analysis, debugging, and monitoring dashboards.
 */

export type AgentStatus = "online" | "offline";

export interface StatusEntry {
  agentName: string;
  status: AgentStatus;
  timestamp: string;
  previousStatus: AgentStatus | null;
  sessionDurationMs: number | null; // duration of previous session if transitioning offline
}

export interface UptimeSummary {
  agentName: string;
  totalOnlineMs: number;
  totalOfflineMs: number;
  uptimePercent: number;
  transitionCount: number;
  lastStatus: AgentStatus;
  lastChangeAt: string;
}

const MAX_HISTORY = 500;

export class AgentStatusHistory {
  private history: StatusEntry[] = [];
  private currentStatus: Map<string, { status: AgentStatus; since: string }> = new Map();

  /** Record a status change. */
  record(agentName: string, status: AgentStatus): StatusEntry {
    const now = new Date().toISOString();
    const prev = this.currentStatus.get(agentName);
    let sessionDurationMs: number | null = null;

    if (prev && prev.status !== status && prev.status === "online") {
      sessionDurationMs = new Date(now).getTime() - new Date(prev.since).getTime();
    }

    const entry: StatusEntry = {
      agentName,
      status,
      timestamp: now,
      previousStatus: prev?.status ?? null,
      sessionDurationMs,
    };

    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    this.currentStatus.set(agentName, { status, since: now });
    return entry;
  }

  /** Get current status for an agent. */
  getCurrent(agentName: string): AgentStatus | null {
    return this.currentStatus.get(agentName)?.status ?? null;
  }

  /** Get status history for an agent. */
  getHistory(agentName: string, limit?: number): StatusEntry[] {
    const entries = this.history.filter((e) => e.agentName === agentName);
    return limit ? entries.slice(-limit) : entries;
  }

  /** Compute uptime summary for an agent from recorded history. */
  computeUptime(agentName: string): UptimeSummary | null {
    const entries = this.getHistory(agentName);
    if (entries.length === 0) return null;

    let totalOnlineMs = 0;
    let totalOfflineMs = 0;
    let transitionCount = 0;

    for (let i = 0; i < entries.length - 1; i++) {
      const duration = new Date(entries[i + 1].timestamp).getTime() - new Date(entries[i].timestamp).getTime();
      if (entries[i].status === "online") totalOnlineMs += duration;
      else totalOfflineMs += duration;
      if (entries[i + 1].status !== entries[i].status) transitionCount++;
    }

    const total = totalOnlineMs + totalOfflineMs;
    const lastEntry = entries[entries.length - 1];

    return {
      agentName,
      totalOnlineMs,
      totalOfflineMs,
      uptimePercent: total > 0 ? Math.round((totalOnlineMs / total) * 100) : 0,
      transitionCount,
      lastStatus: lastEntry.status,
      lastChangeAt: lastEntry.timestamp,
    };
  }

  /** List all tracked agent names. */
  trackedAgents(): string[] {
    return [...this.currentStatus.keys()];
  }

  /** Count total entries. */
  size(): number {
    return this.history.length;
  }

  /** Clear all data. */
  clear(): void {
    this.history = [];
    this.currentStatus.clear();
  }
}
