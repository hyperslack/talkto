/**
 * Message priority — flag messages with urgency levels.
 *
 * Stored in-memory. Agents and humans can mark messages as
 * high/medium/low priority to help triage conversations.
 */

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export interface MessagePriority {
  messageId: string;
  priority: PriorityLevel;
  setBy: string; // userId
  setAt: string;
  reason: string | null;
}

const store = new Map<string, MessagePriority>();

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

/** Set priority on a message. */
export function setPriority(
  messageId: string,
  priority: PriorityLevel,
  setBy: string,
  reason: string | null = null,
): MessagePriority {
  const entry: MessagePriority = {
    messageId,
    priority,
    setBy,
    setAt: new Date().toISOString(),
    reason,
  };
  store.set(messageId, entry);
  return entry;
}

/** Get priority for a message. */
export function getPriority(messageId: string): MessagePriority | null {
  return store.get(messageId) ?? null;
}

/** Remove priority from a message. */
export function clearPriority(messageId: string): boolean {
  return store.delete(messageId);
}

/** Check if a priority level is valid. */
export function isValidPriority(level: string): level is PriorityLevel {
  return level in PRIORITY_ORDER;
}

/** Get all messages with a specific priority level. */
export function listByPriority(level: PriorityLevel): MessagePriority[] {
  const result: MessagePriority[] = [];
  for (const p of store.values()) {
    if (p.priority === level) result.push(p);
  }
  return result.sort((a, b) => b.setAt.localeCompare(a.setAt));
}

/** Get all prioritized messages, sorted by urgency (highest first). */
export function listAllPrioritized(): MessagePriority[] {
  return [...store.values()].sort(
    (a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] || b.setAt.localeCompare(a.setAt),
  );
}

/** Get priority emoji for display. */
export function priorityEmoji(level: PriorityLevel): string {
  switch (level) {
    case "urgent": return "🔴";
    case "high": return "🟠";
    case "medium": return "🟡";
    case "low": return "🟢";
  }
}

/** Get priority label for display. */
export function priorityLabel(level: PriorityLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Clear all (for testing). */
export function clearAll(): void {
  store.clear();
}
