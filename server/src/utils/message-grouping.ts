/**
 * Message grouping utilities — groups consecutive messages from the same sender
 * within a configurable time window for a compact chat UI (Slack-style).
 *
 * When consecutive messages from the same sender arrive within the window,
 * only the first shows the avatar/name; the rest are "continuation" bubbles.
 */

export interface GroupableMessage {
  id: string;
  sender_id: string;
  created_at: string;
  parent_id?: string | null;
}

export interface GroupedMessage<T extends GroupableMessage> {
  message: T;
  /** True if this message starts a new visual group (show avatar/name). */
  isGroupStart: boolean;
  /** True if this is a continuation of the previous sender's group. */
  isContinuation: boolean;
  /** Position in group: 'first' | 'middle' | 'last' | 'solo' */
  position: "first" | "middle" | "last" | "solo";
  /** Index of the group this message belongs to (0-based). */
  groupIndex: number;
}

/** Default grouping window: 5 minutes. */
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Group an array of messages by consecutive sender within a time window.
 * Messages should already be sorted chronologically (oldest first).
 */
export function groupMessages<T extends GroupableMessage>(
  messages: T[],
  windowMs: number = DEFAULT_WINDOW_MS,
): GroupedMessage<T>[] {
  if (messages.length === 0) return [];

  const result: GroupedMessage<T>[] = [];
  let groupIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;

    const sameGroup = prev !== null && isSameGroup(prev, msg, windowMs);

    if (!sameGroup) {
      // Mark previous message's position
      if (result.length > 0) {
        const last = result[result.length - 1];
        if (last.position === "first") {
          last.position = "solo";
        } else if (last.position === "middle" || last.position === "first") {
          last.position = "last";
        }
      }
      groupIndex = result.length > 0 ? result[result.length - 1].groupIndex + 1 : 0;
    }

    result.push({
      message: msg,
      isGroupStart: !sameGroup,
      isContinuation: sameGroup,
      position: sameGroup ? "middle" : "first",
      groupIndex,
    });
  }

  // Fix the last message's position
  if (result.length > 0) {
    const last = result[result.length - 1];
    if (last.position === "first") {
      last.position = "solo";
    } else if (last.position === "middle") {
      last.position = "last";
    }
  }

  return result;
}

/**
 * Check if two consecutive messages belong to the same visual group.
 */
function isSameGroup(
  prev: GroupableMessage,
  curr: GroupableMessage,
  windowMs: number,
): boolean {
  // Different sender = new group
  if (prev.sender_id !== curr.sender_id) return false;

  // Thread root messages break groups (replies are separate context)
  if (curr.parent_id && curr.parent_id !== prev.parent_id) return false;

  // Time gap too large = new group
  const prevTime = new Date(prev.created_at).getTime();
  const currTime = new Date(curr.created_at).getTime();
  if (isNaN(prevTime) || isNaN(currTime)) return false;

  return Math.abs(currTime - prevTime) <= windowMs;
}

/**
 * Count the number of visual groups in a message list.
 */
export function countGroups<T extends GroupableMessage>(
  messages: T[],
  windowMs: number = DEFAULT_WINDOW_MS,
): number {
  const grouped = groupMessages(messages, windowMs);
  if (grouped.length === 0) return 0;
  return grouped[grouped.length - 1].groupIndex + 1;
}

/**
 * Get messages that start each group (for rendering group headers).
 */
export function getGroupStarts<T extends GroupableMessage>(
  messages: T[],
  windowMs: number = DEFAULT_WINDOW_MS,
): T[] {
  return groupMessages(messages, windowMs)
    .filter((g) => g.isGroupStart)
    .map((g) => g.message);
}

/**
 * Split messages into groups (arrays of consecutive messages from same sender).
 */
export function splitIntoGroups<T extends GroupableMessage>(
  messages: T[],
  windowMs: number = DEFAULT_WINDOW_MS,
): T[][] {
  const grouped = groupMessages(messages, windowMs);
  const groups: T[][] = [];
  let current: T[] = [];

  for (const g of grouped) {
    if (g.isGroupStart && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(g.message);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}
