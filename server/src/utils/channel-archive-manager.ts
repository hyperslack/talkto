/**
 * Channel archive manager — utilities for managing channel archival lifecycle.
 *
 * Handles archive eligibility checks, batch archival planning, and
 * archive/unarchive state transitions.
 */

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  isArchived: boolean;
  lastMessageAt: string | null;
  memberCount: number;
  createdAt: string;
}

export interface ArchiveCandidate {
  channel: ChannelInfo;
  daysSinceLastMessage: number | null;
  reason: string;
}

export interface ArchivePlan {
  candidates: ArchiveCandidate[];
  protected: ChannelInfo[];
  totalCandidates: number;
}

const PROTECTED_NAMES = new Set(["general"]);

/** Check if a channel is protected from archival. */
export function isProtected(channel: ChannelInfo): boolean {
  return PROTECTED_NAMES.has(channel.name) || channel.type === "dm";
}

/** Calculate days since last message (null if no messages). */
export function daysSinceLastMessage(lastMessageAt: string | null, now?: Date): number | null {
  if (!lastMessageAt) return null;
  const diff = (now ?? new Date()).getTime() - new Date(lastMessageAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Build an archive plan based on inactivity threshold. */
export function buildArchivePlan(channels: ChannelInfo[], inactivityDays: number, now?: Date): ArchivePlan {
  const candidates: ArchiveCandidate[] = [];
  const protectedChannels: ChannelInfo[] = [];

  for (const ch of channels) {
    if (ch.isArchived) continue;
    if (isProtected(ch)) {
      protectedChannels.push(ch);
      continue;
    }

    const days = daysSinceLastMessage(ch.lastMessageAt, now);

    if (days === null && ch.memberCount === 0) {
      candidates.push({ channel: ch, daysSinceLastMessage: null, reason: "empty channel with no messages" });
    } else if (days !== null && days >= inactivityDays) {
      candidates.push({ channel: ch, daysSinceLastMessage: days, reason: `inactive for ${days} days` });
    }
  }

  candidates.sort((a, b) => (b.daysSinceLastMessage ?? Infinity) - (a.daysSinceLastMessage ?? Infinity));

  return { candidates, protected: protectedChannels, totalCandidates: candidates.length };
}

/** Check if a channel can be archived. */
export function canArchive(channel: ChannelInfo): { allowed: boolean; reason?: string } {
  if (channel.isArchived) return { allowed: false, reason: "Already archived" };
  if (isProtected(channel)) return { allowed: false, reason: `#${channel.name} is protected` };
  return { allowed: true };
}

/** Check if a channel can be unarchived. */
export function canUnarchive(channel: ChannelInfo): { allowed: boolean; reason?: string } {
  if (!channel.isArchived) return { allowed: false, reason: "Not archived" };
  return { allowed: true };
}

/** Format an archive plan as a summary string. */
export function formatPlanSummary(plan: ArchivePlan): string {
  const lines: string[] = [`📦 Archive Plan: ${plan.totalCandidates} candidate${plan.totalCandidates !== 1 ? "s" : ""}`];
  for (const c of plan.candidates.slice(0, 10)) {
    lines.push(`  • #${c.channel.name} — ${c.reason}`);
  }
  if (plan.candidates.length > 10) {
    lines.push(`  ... and ${plan.candidates.length - 10} more`);
  }
  if (plan.protected.length > 0) {
    lines.push(`🛡️ Protected: ${plan.protected.map((c) => `#${c.name}`).join(", ")}`);
  }
  return lines.join("\n");
}
