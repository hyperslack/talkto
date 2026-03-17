/**
 * Thread flattening utilities — convert threaded messages into flat views.
 *
 * Useful for exporting, searching, and rendering thread-aware message lists.
 */

export interface ThreadMessage {
  id: string;
  parentId: string | null;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface FlattenedMessage extends ThreadMessage {
  depth: number;
  threadRootId: string;
  isRoot: boolean;
}

export interface ThreadTree {
  root: ThreadMessage;
  replies: ThreadMessage[];
  depth: number;
  participantIds: Set<string>;
  lastReplyAt: string | null;
}

/** Build a map of parentId → children. */
export function buildChildMap(messages: ThreadMessage[]): Map<string, ThreadMessage[]> {
  const map = new Map<string, ThreadMessage[]>();
  for (const msg of messages) {
    if (msg.parentId) {
      const siblings = map.get(msg.parentId) ?? [];
      siblings.push(msg);
      map.set(msg.parentId, siblings);
    }
  }
  return map;
}

/** Flatten a list of threaded messages into depth-annotated flat list. */
export function flattenThreads(messages: ThreadMessage[]): FlattenedMessage[] {
  const childMap = buildChildMap(messages);
  const roots = messages.filter((m) => !m.parentId);
  const result: FlattenedMessage[] = [];

  function walk(msg: ThreadMessage, depth: number, rootId: string) {
    result.push({
      ...msg,
      depth,
      threadRootId: rootId,
      isRoot: depth === 0,
    });
    const children = childMap.get(msg.id) ?? [];
    children.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const child of children) {
      walk(child, depth + 1, rootId);
    }
  }

  roots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const root of roots) {
    walk(root, 0, root.id);
  }
  return result;
}

/** Build thread trees from a flat list. */
export function buildThreadTrees(messages: ThreadMessage[]): ThreadTree[] {
  const childMap = buildChildMap(messages);
  const roots = messages.filter((m) => !m.parentId);
  const trees: ThreadTree[] = [];

  for (const root of roots) {
    const replies: ThreadMessage[] = [];
    const participantIds = new Set<string>([root.senderId]);
    let maxDepth = 0;

    function collect(msg: ThreadMessage, depth: number) {
      const children = childMap.get(msg.id) ?? [];
      for (const child of children) {
        replies.push(child);
        participantIds.add(child.senderId);
        if (depth + 1 > maxDepth) maxDepth = depth + 1;
        collect(child, depth + 1);
      }
    }

    collect(root, 0);
    const lastReply = replies.length > 0
      ? replies.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
      : null;

    trees.push({ root, replies, depth: maxDepth, participantIds, lastReplyAt: lastReply });
  }

  return trees;
}

/** Get only root messages (no replies). */
export function getRoots(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.filter((m) => !m.parentId);
}

/** Count total replies across all threads. */
export function countReplies(messages: ThreadMessage[]): number {
  return messages.filter((m) => m.parentId !== null).length;
}

/** Find the deepest nesting level in the message list. */
export function maxThreadDepth(messages: ThreadMessage[]): number {
  const trees = buildThreadTrees(messages);
  return trees.reduce((max, t) => Math.max(max, t.depth), 0);
}

/** Format a flattened message with indentation for display. */
export function formatIndented(msg: FlattenedMessage, indent: string = "  "): string {
  const prefix = indent.repeat(msg.depth);
  return `${prefix}[${msg.senderName}]: ${msg.content}`;
}
