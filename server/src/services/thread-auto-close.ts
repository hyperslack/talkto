/**
 * Thread auto-close — automatically marks threads as resolved/closed
 * after a configurable period of inactivity.
 *
 * In-memory config store for per-channel settings.
 */

export interface ThreadCloseConfig {
  channelId: string;
  inactivityMinutes: number; // close after N minutes with no reply
  enabled: boolean;
}

export interface ThreadStatus {
  messageId: string;
  channelId: string;
  lastActivityAt: string; // ISO 8601
  isClosed: boolean;
  closedAt: string | null;
  closedReason: "inactivity" | "manual" | null;
}

const configs = new Map<string, ThreadCloseConfig>();
const threads = new Map<string, ThreadStatus>();

/** Set auto-close config for a channel. */
export function setAutoCloseConfig(
  channelId: string,
  inactivityMinutes: number,
  enabled: boolean = true,
): ThreadCloseConfig {
  const config: ThreadCloseConfig = { channelId, inactivityMinutes, enabled };
  configs.set(channelId, config);
  return config;
}

/** Get auto-close config for a channel. */
export function getAutoCloseConfig(channelId: string): ThreadCloseConfig | null {
  return configs.get(channelId) ?? null;
}

/** Remove auto-close config for a channel. */
export function removeAutoCloseConfig(channelId: string): boolean {
  return configs.delete(channelId);
}

/** Register or update thread activity. */
export function updateThreadActivity(messageId: string, channelId: string): ThreadStatus {
  const existing = threads.get(messageId);
  if (existing) {
    existing.lastActivityAt = new Date().toISOString();
    if (existing.isClosed) {
      // Re-open if new activity
      existing.isClosed = false;
      existing.closedAt = null;
      existing.closedReason = null;
    }
    return existing;
  }
  const status: ThreadStatus = {
    messageId,
    channelId,
    lastActivityAt: new Date().toISOString(),
    isClosed: false,
    closedAt: null,
    closedReason: null,
  };
  threads.set(messageId, status);
  return status;
}

/** Manually close a thread. */
export function closeThread(messageId: string): boolean {
  const thread = threads.get(messageId);
  if (!thread || thread.isClosed) return false;
  thread.isClosed = true;
  thread.closedAt = new Date().toISOString();
  thread.closedReason = "manual";
  return true;
}

/** Scan and close threads that have been inactive past their channel's threshold. */
export function closeInactiveThreads(): ThreadStatus[] {
  const now = Date.now();
  const closed: ThreadStatus[] = [];

  for (const thread of threads.values()) {
    if (thread.isClosed) continue;
    const config = configs.get(thread.channelId);
    if (!config || !config.enabled) continue;

    const lastActivity = new Date(thread.lastActivityAt).getTime();
    const thresholdMs = config.inactivityMinutes * 60_000;

    if (now - lastActivity >= thresholdMs) {
      thread.isClosed = true;
      thread.closedAt = new Date().toISOString();
      thread.closedReason = "inactivity";
      closed.push(thread);
    }
  }

  return closed;
}

/** Get thread status. */
export function getThreadStatus(messageId: string): ThreadStatus | null {
  return threads.get(messageId) ?? null;
}

/** List all open threads for a channel. */
export function listOpenThreads(channelId: string): ThreadStatus[] {
  const result: ThreadStatus[] = [];
  for (const t of threads.values()) {
    if (t.channelId === channelId && !t.isClosed) result.push(t);
  }
  return result;
}

/** Clear all state (for testing). */
export function clearAll(): void {
  configs.clear();
  threads.clear();
}
