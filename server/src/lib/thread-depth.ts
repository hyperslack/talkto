/**
 * Thread depth utilities — manages nesting depth limits for message threads.
 *
 * Prevents deeply nested conversations that are hard to follow.
 * When a message would exceed the max depth, it's re-parented to the
 * nearest allowed ancestor.
 */

export interface ThreadNode {
  id: string;
  parentId: string | null;
}

export interface DepthResult {
  depth: number;
  exceedsLimit: boolean;
  resolvedParentId: string | null;
}

/** Default maximum thread depth (root = 0, first reply = 1, etc.) */
export const DEFAULT_MAX_DEPTH = 5;

/**
 * Compute the depth of a message in a thread tree.
 */
export function computeDepth(messageId: string, messages: Map<string, ThreadNode>): number {
  let depth = 0;
  let current = messages.get(messageId);
  const visited = new Set<string>();

  while (current?.parentId) {
    if (visited.has(current.parentId)) break; // cycle protection
    visited.add(current.parentId);
    depth++;
    current = messages.get(current.parentId);
  }

  return depth;
}

/**
 * Resolve the correct parent for a new reply, respecting the depth limit.
 * If replying to a message that's already at max depth, walk up the tree
 * to find the deepest allowed parent.
 */
export function resolveParent(
  targetParentId: string,
  messages: Map<string, ThreadNode>,
  maxDepth = DEFAULT_MAX_DEPTH
): DepthResult {
  const parentNode = messages.get(targetParentId);
  if (!parentNode) {
    return { depth: 0, exceedsLimit: false, resolvedParentId: targetParentId };
  }

  const parentDepth = computeDepth(targetParentId, messages);
  const newDepth = parentDepth + 1;

  if (newDepth <= maxDepth) {
    return { depth: newDepth, exceedsLimit: false, resolvedParentId: targetParentId };
  }

  // Walk up to find the deepest parent within limit
  let current = parentNode;
  let currentDepth = parentDepth;
  while (currentDepth >= maxDepth && current.parentId) {
    const parent = messages.get(current.parentId);
    if (!parent) break;
    current = parent;
    currentDepth--;
  }

  return {
    depth: maxDepth,
    exceedsLimit: true,
    resolvedParentId: current.id,
  };
}

/**
 * Build a thread tree from a flat list of messages.
 */
export function buildThreadMap(messages: Array<{ id: string; parentId: string | null }>): Map<string, ThreadNode> {
  const map = new Map<string, ThreadNode>();
  for (const m of messages) {
    map.set(m.id, { id: m.id, parentId: m.parentId });
  }
  return map;
}

/**
 * Get the root message of a thread.
 */
export function getThreadRoot(messageId: string, messages: Map<string, ThreadNode>): string {
  let current = messages.get(messageId);
  const visited = new Set<string>();

  while (current?.parentId) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    const parent = messages.get(current.parentId);
    if (!parent) break;
    current = parent;
  }

  return current?.id ?? messageId;
}

/**
 * Count total messages in a thread (including root).
 */
export function threadSize(rootId: string, messages: Map<string, ThreadNode>): number {
  let count = messages.has(rootId) ? 1 : 0;
  for (const node of messages.values()) {
    if (node.id !== rootId && getThreadRoot(node.id, messages) === rootId) {
      count++;
    }
  }
  return count;
}
