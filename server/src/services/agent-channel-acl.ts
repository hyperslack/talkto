/**
 * Agent channel ACL — restrict which channels agents can post to.
 *
 * By default, agents can post to any channel. When an ACL is set for an agent,
 * they can only post to the explicitly allowed channels.
 *
 * In-memory store keyed by agent ID → Set of allowed channel IDs.
 * If an agent has no entry, they have full access (permissive by default).
 */

// agentId → Set<channelId> (empty set = no channels allowed)
export const agentAcl = new Map<string, Set<string>>();

/** Check if an agent is allowed to post in a channel */
export function isAgentAllowed(agentId: string, channelId: string): boolean {
  const allowed = agentAcl.get(agentId);
  if (!allowed) return true; // No ACL = full access
  return allowed.has(channelId);
}

/** Set allowed channels for an agent (replaces existing) */
export function setAgentChannels(agentId: string, channelIds: string[]): void {
  agentAcl.set(agentId, new Set(channelIds));
}

/** Get allowed channels for an agent (null = unrestricted) */
export function getAgentChannels(agentId: string): string[] | null {
  const allowed = agentAcl.get(agentId);
  if (!allowed) return null;
  return Array.from(allowed);
}

/** Remove ACL for an agent (restore full access) */
export function clearAgentAcl(agentId: string): void {
  agentAcl.delete(agentId);
}

/** Clear all ACLs (for testing) */
export function clearAllAcls(): void {
  agentAcl.clear();
}
