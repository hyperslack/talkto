/**
 * Message search and filter utilities for client-side filtering.
 *
 * Provides composable filter predicates for message lists, enabling
 * in-memory search, sender filtering, date range, and content type detection.
 */

export interface MessageLike {
  id: string;
  content: string;
  sender_name: string | null;
  sender_type: "human" | "agent" | null;
  created_at: string;
  parent_id: string | null;
  is_pinned?: boolean;
}

export type MessageFilter = (msg: MessageLike) => boolean;

/**
 * Filter by text content (case-insensitive substring match).
 */
export function byContent(query: string): MessageFilter {
  const lower = query.toLowerCase();
  return (msg) => msg.content.toLowerCase().includes(lower);
}

/**
 * Filter by sender name (case-insensitive exact match).
 */
export function bySender(name: string): MessageFilter {
  const lower = name.toLowerCase();
  return (msg) => (msg.sender_name ?? "").toLowerCase() === lower;
}

/**
 * Filter by sender type.
 */
export function bySenderType(type: "human" | "agent"): MessageFilter {
  return (msg) => msg.sender_type === type;
}

/**
 * Filter by date range (ISO strings).
 */
export function byDateRange(after?: string, before?: string): MessageFilter {
  return (msg) => {
    if (after && msg.created_at < after) return false;
    if (before && msg.created_at > before) return false;
    return true;
  };
}

/**
 * Filter for messages that are thread roots (have replies but no parent).
 */
export function isThreadRoot(): MessageFilter {
  return (msg) => msg.parent_id === null;
}

/**
 * Filter for pinned messages.
 */
export function isPinned(): MessageFilter {
  return (msg) => msg.is_pinned === true;
}

/**
 * Filter for messages containing code blocks.
 */
export function hasCode(): MessageFilter {
  return (msg) => /```[\s\S]*?```/.test(msg.content) || /`[^`]+`/.test(msg.content);
}

/**
 * Filter for messages containing @mentions.
 */
export function hasMentions(): MessageFilter {
  return (msg) => /@\w+/.test(msg.content);
}

/**
 * Compose multiple filters with AND logic.
 */
export function composeFilters(...filters: MessageFilter[]): MessageFilter {
  return (msg) => filters.every((f) => f(msg));
}

/**
 * Apply filters to a message array and return matching messages.
 */
export function filterMessages(messages: MessageLike[], ...filters: MessageFilter[]): MessageLike[] {
  const composed = composeFilters(...filters);
  return messages.filter(composed);
}

/**
 * Search messages and return with match count.
 */
export function searchMessages(
  messages: MessageLike[],
  query: string
): { results: MessageLike[]; total: number } {
  const results = messages.filter(byContent(query));
  return { results, total: results.length };
}

/**
 * Count occurrences of a search term across messages.
 */
export function countOccurrences(messages: MessageLike[], query: string): number {
  const lower = query.toLowerCase();
  let count = 0;
  for (const msg of messages) {
    const content = msg.content.toLowerCase();
    let pos = 0;
    while ((pos = content.indexOf(lower, pos)) !== -1) {
      count++;
      pos += lower.length;
    }
  }
  return count;
}
