/**
 * Thread breadcrumb utilities — build navigation paths through
 * nested thread hierarchies for reply-chain visualization.
 */

export interface BreadcrumbNode {
  messageId: string;
  senderId: string;
  senderName: string;
  preview: string;
  depth: number;
}

export interface ThreadPath {
  nodes: BreadcrumbNode[];
  totalDepth: number;
  rootMessageId: string;
}

/**
 * Message lookup function type — resolves a message by ID.
 */
export type MessageLookup = (messageId: string) => {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  parentId: string | null;
} | null;

/**
 * Build the breadcrumb path from a message up to the thread root.
 */
export function buildBreadcrumbs(messageId: string, lookup: MessageLookup, maxDepth: number = 20): ThreadPath {
  const nodes: BreadcrumbNode[] = [];
  let currentId: string | null = messageId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const msg = lookup(currentId);
    if (!msg) break;

    nodes.unshift({
      messageId: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      preview: generatePreview(msg.content),
      depth,
    });

    currentId = msg.parentId;
    depth++;
  }

  // Re-number depths from root (0) to leaf
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].depth = i;
  }

  return {
    nodes,
    totalDepth: nodes.length,
    rootMessageId: nodes.length > 0 ? nodes[0].messageId : messageId,
  };
}

/**
 * Generate a short preview of message content.
 */
export function generatePreview(content: string, maxLength: number = 80): string {
  const singleLine = content.replace(/\n+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  const truncated = singleLine.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.5 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Format breadcrumb path as a compact display string.
 * e.g., "Alice > Bob > Charlie"
 */
export function formatBreadcrumbPath(path: ThreadPath): string {
  if (path.nodes.length === 0) return "";
  return path.nodes.map((n) => n.senderName).join(" › ");
}

/**
 * Format breadcrumb path as a detailed string with previews.
 */
export function formatDetailedBreadcrumbs(path: ThreadPath): string {
  return path.nodes
    .map((n, i) => {
      const indent = "  ".repeat(i);
      return `${indent}${n.senderName}: ${n.preview}`;
    })
    .join("\n");
}

/**
 * Check if a thread has exceeded a recommended depth.
 */
export function isDeepThread(path: ThreadPath, threshold: number = 5): boolean {
  return path.totalDepth > threshold;
}

/**
 * Get the immediate ancestors (last N nodes before the current message).
 */
export function getRecentAncestors(path: ThreadPath, count: number = 3): BreadcrumbNode[] {
  if (path.nodes.length <= 1) return [];
  return path.nodes.slice(Math.max(0, path.nodes.length - 1 - count), path.nodes.length - 1);
}

/**
 * Get participants in the thread path (unique sender names).
 */
export function getThreadParticipants(path: ThreadPath): string[] {
  const seen = new Set<string>();
  return path.nodes
    .map((n) => n.senderName)
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}
