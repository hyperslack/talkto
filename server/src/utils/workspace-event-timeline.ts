/**
 * Workspace event timeline utilities.
 *
 * Provides a unified timeline of workspace events (messages, joins, channel
 * creation, agent status changes) for activity feeds and dashboards.
 */

export type EventKind =
  | "message"
  | "channel_created"
  | "channel_archived"
  | "member_joined"
  | "member_left"
  | "agent_online"
  | "agent_offline"
  | "topic_changed"
  | "pin";

export interface TimelineEvent {
  id: string;
  kind: EventKind;
  timestamp: number; // epoch ms
  actorName: string;
  actorType: "human" | "agent" | "system";
  channelId?: string;
  channelName?: string;
  detail?: string; // extra context (message preview, new topic, etc.)
}

/**
 * In-memory event timeline with bounded capacity.
 */
export class EventTimeline {
  private events: TimelineEvent[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Record a new event.
   */
  push(event: TimelineEvent): void {
    this.events.push(event);
    // Trim from front if over capacity
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(this.events.length - this.maxSize);
    }
  }

  /**
   * Get recent events, optionally filtered.
   */
  recent(opts?: {
    limit?: number;
    kinds?: EventKind[];
    channelId?: string;
    since?: number;
  }): TimelineEvent[] {
    let result = this.events;

    if (opts?.since) {
      result = result.filter((e) => e.timestamp >= opts.since!);
    }
    if (opts?.kinds && opts.kinds.length > 0) {
      const kindSet = new Set(opts.kinds);
      result = result.filter((e) => kindSet.has(e.kind));
    }
    if (opts?.channelId) {
      result = result.filter((e) => e.channelId === opts.channelId);
    }

    // Return newest first
    const sorted = [...result].reverse();
    return sorted.slice(0, opts?.limit ?? 50);
  }

  /**
   * Count events by kind within a time window.
   */
  countByKind(sinceMs: number, now: number = Date.now()): Record<string, number> {
    const counts: Record<string, number> = {};
    const cutoff = now - sinceMs;
    for (const e of this.events) {
      if (e.timestamp >= cutoff) {
        counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      }
    }
    return counts;
  }

  /**
   * Get the total event count.
   */
  get size(): number {
    return this.events.length;
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * Get an emoji icon for an event kind.
 */
export function eventIcon(kind: EventKind): string {
  const icons: Record<EventKind, string> = {
    message: "💬",
    channel_created: "📢",
    channel_archived: "📦",
    member_joined: "👋",
    member_left: "🚪",
    agent_online: "🤖",
    agent_offline: "💤",
    topic_changed: "📝",
    pin: "📌",
  };
  return icons[kind];
}

/**
 * Format a timeline event as a single-line summary.
 */
export function formatEvent(event: TimelineEvent): string {
  const icon = eventIcon(event.kind);
  switch (event.kind) {
    case "message":
      return `${icon} ${event.actorName} in #${event.channelName ?? "unknown"}: ${event.detail ?? ""}`;
    case "channel_created":
      return `${icon} ${event.actorName} created #${event.channelName ?? "unknown"}`;
    case "channel_archived":
      return `${icon} ${event.actorName} archived #${event.channelName ?? "unknown"}`;
    case "member_joined":
      return `${icon} ${event.actorName} joined the workspace`;
    case "member_left":
      return `${icon} ${event.actorName} left the workspace`;
    case "agent_online":
      return `${icon} ${event.actorName} came online`;
    case "agent_offline":
      return `${icon} ${event.actorName} went offline`;
    case "topic_changed":
      return `${icon} ${event.actorName} changed topic in #${event.channelName ?? "unknown"}`;
    case "pin":
      return `${icon} ${event.actorName} pinned a message in #${event.channelName ?? "unknown"}`;
  }
}
