/**
 * Channel membership diff utilities.
 *
 * Computes differences between membership snapshots to track
 * who joined, left, or changed roles over time.
 */

export interface MemberSnapshot {
  userId: string;
  role?: string;
  joinedAt?: string;
}

export interface MembershipDiff {
  joined: MemberSnapshot[];
  left: MemberSnapshot[];
  roleChanged: Array<{
    userId: string;
    oldRole: string;
    newRole: string;
  }>;
}

/**
 * Compute the diff between two membership snapshots.
 */
export function diffMemberships(
  before: MemberSnapshot[],
  after: MemberSnapshot[]
): MembershipDiff {
  const beforeMap = new Map(before.map((m) => [m.userId, m]));
  const afterMap = new Map(after.map((m) => [m.userId, m]));

  const joined: MemberSnapshot[] = [];
  const left: MemberSnapshot[] = [];
  const roleChanged: MembershipDiff["roleChanged"] = [];

  // Find joined and role changes
  for (const [userId, member] of afterMap) {
    const prev = beforeMap.get(userId);
    if (!prev) {
      joined.push(member);
    } else if (prev.role && member.role && prev.role !== member.role) {
      roleChanged.push({
        userId,
        oldRole: prev.role,
        newRole: member.role,
      });
    }
  }

  // Find left
  for (const [userId, member] of beforeMap) {
    if (!afterMap.has(userId)) {
      left.push(member);
    }
  }

  return { joined, left, roleChanged };
}

/**
 * Check if membership changed between two snapshots.
 */
export function hasMembershipChanged(
  before: MemberSnapshot[],
  after: MemberSnapshot[]
): boolean {
  const diff = diffMemberships(before, after);
  return diff.joined.length > 0 || diff.left.length > 0 || diff.roleChanged.length > 0;
}

/**
 * Format a membership diff as a human-readable summary.
 */
export function formatDiffSummary(
  diff: MembershipDiff,
  nameResolver?: (userId: string) => string
): string {
  const resolve = nameResolver ?? ((id: string) => id);
  const parts: string[] = [];

  if (diff.joined.length > 0) {
    const names = diff.joined.map((m) => resolve(m.userId)).join(", ");
    parts.push(`Joined: ${names}`);
  }
  if (diff.left.length > 0) {
    const names = diff.left.map((m) => resolve(m.userId)).join(", ");
    parts.push(`Left: ${names}`);
  }
  if (diff.roleChanged.length > 0) {
    const changes = diff.roleChanged
      .map((c) => `${resolve(c.userId)} (${c.oldRole} → ${c.newRole})`)
      .join(", ");
    parts.push(`Role changed: ${changes}`);
  }

  return parts.length > 0 ? parts.join(". ") : "No changes";
}

/**
 * Compute net membership change (+/- count).
 */
export function netChange(diff: MembershipDiff): number {
  return diff.joined.length - diff.left.length;
}

/**
 * Get user IDs that are in both before and after (stable members).
 */
export function stableMembers(
  before: MemberSnapshot[],
  after: MemberSnapshot[]
): string[] {
  const beforeIds = new Set(before.map((m) => m.userId));
  return after.filter((m) => beforeIds.has(m.userId)).map((m) => m.userId);
}

/**
 * Compute membership turnover rate (0-1).
 * turnover = (joined + left) / max(before.length, after.length, 1)
 */
export function turnoverRate(
  before: MemberSnapshot[],
  after: MemberSnapshot[]
): number {
  const diff = diffMemberships(before, after);
  const total = Math.max(before.length, after.length, 1);
  return (diff.joined.length + diff.left.length) / total;
}
