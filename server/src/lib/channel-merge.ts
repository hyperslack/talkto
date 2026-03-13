/**
 * Channel merge planning utilities.
 *
 * Computes a merge plan for combining two channels: moving messages,
 * merging members, and handling metadata. The actual DB operations are
 * performed by the caller — this module just computes the plan.
 */

export interface ChannelInfo {
  id: string;
  name: string;
  memberIds: string[];
  messageCount: number;
  createdAt: string;
}

export interface MergePlan {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  messagesToMove: number;
  newMembersToAdd: string[];
  existingMembers: string[];
  totalMembersAfter: number;
  canMerge: boolean;
  reason?: string;
}

/**
 * Compute a merge plan for moving all content from source into target.
 */
export function computeMergePlan(source: ChannelInfo, target: ChannelInfo): MergePlan {
  if (source.id === target.id) {
    return {
      sourceId: source.id,
      targetId: target.id,
      sourceName: source.name,
      targetName: target.name,
      messagesToMove: 0,
      newMembersToAdd: [],
      existingMembers: source.memberIds,
      totalMembersAfter: source.memberIds.length,
      canMerge: false,
      reason: "Cannot merge a channel with itself",
    };
  }

  const targetMemberSet = new Set(target.memberIds);
  const newMembers = source.memberIds.filter((id) => !targetMemberSet.has(id));
  const existingMembers = source.memberIds.filter((id) => targetMemberSet.has(id));

  return {
    sourceId: source.id,
    targetId: target.id,
    sourceName: source.name,
    targetName: target.name,
    messagesToMove: source.messageCount,
    newMembersToAdd: newMembers,
    existingMembers,
    totalMembersAfter: target.memberIds.length + newMembers.length,
    canMerge: true,
  };
}

/**
 * Validate that a channel can be used as a merge source.
 * #general should never be merged away.
 */
export function canBeSource(channel: ChannelInfo): { ok: boolean; reason?: string } {
  if (channel.name === "#general") {
    return { ok: false, reason: "#general cannot be merged into another channel" };
  }
  return { ok: true };
}

/**
 * Generate a system message announcing the merge.
 */
export function mergeAnnouncement(sourceName: string, targetName: string, messageCount: number): string {
  return `📦 Channel **${sourceName}** has been merged into **${targetName}**. ${messageCount} message${messageCount === 1 ? "" : "s"} moved.`;
}

/**
 * Estimate merge duration based on message count (rough heuristic).
 */
export function estimateMergeDuration(messageCount: number): { seconds: number; label: string } {
  // ~1000 messages per second for SQLite batch updates
  const seconds = Math.max(1, Math.ceil(messageCount / 1000));
  if (seconds < 60) return { seconds, label: `~${seconds}s` };
  const minutes = Math.ceil(seconds / 60);
  return { seconds, label: `~${minutes}min` };
}
