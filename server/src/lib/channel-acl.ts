/**
 * Channel access control list (ACL) utilities — manages per-channel
 * permission grants and denials for users and roles.
 */

export type Permission = "read" | "write" | "invite" | "pin" | "manage";
export type AclAction = "allow" | "deny";

export interface AclEntry {
  channelId: string;
  subjectId: string; // user or role ID
  subjectType: "user" | "role";
  permission: Permission;
  action: AclAction;
  grantedBy: string;
  grantedAt: string;
}

const ALL_PERMISSIONS: Permission[] = ["read", "write", "invite", "pin", "manage"];

/**
 * In-memory ACL store for channel permissions.
 */
export class ChannelAclStore {
  private entries: AclEntry[] = [];

  /**
   * Grant or deny a permission.
   */
  set(entry: Omit<AclEntry, "grantedAt">): AclEntry {
    // Remove existing entry for same subject + permission + channel
    this.entries = this.entries.filter(
      (e) => !(e.channelId === entry.channelId && e.subjectId === entry.subjectId && e.permission === entry.permission)
    );

    const full: AclEntry = { ...entry, grantedAt: new Date().toISOString() };
    this.entries.push(full);
    return full;
  }

  /**
   * Remove a specific ACL entry.
   */
  remove(channelId: string, subjectId: string, permission: Permission): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (e) => !(e.channelId === channelId && e.subjectId === subjectId && e.permission === permission)
    );
    return this.entries.length < before;
  }

  /**
   * Check if a subject has a specific permission on a channel.
   * Returns true if explicitly allowed, false if explicitly denied, null if no rule.
   */
  check(channelId: string, subjectId: string, permission: Permission): boolean | null {
    const entry = this.entries.find(
      (e) => e.channelId === channelId && e.subjectId === subjectId && e.permission === permission
    );
    if (!entry) return null;
    return entry.action === "allow";
  }

  /**
   * Check permission with fallback: explicit rule > default.
   */
  isAllowed(channelId: string, subjectId: string, permission: Permission, defaultAllow: boolean = true): boolean {
    const explicit = this.check(channelId, subjectId, permission);
    if (explicit !== null) return explicit;
    return defaultAllow;
  }

  /**
   * Get all ACL entries for a channel.
   */
  getChannelAcl(channelId: string): AclEntry[] {
    return this.entries.filter((e) => e.channelId === channelId);
  }

  /**
   * Get all permissions for a subject across all channels.
   */
  getSubjectPermissions(subjectId: string): AclEntry[] {
    return this.entries.filter((e) => e.subjectId === subjectId);
  }

  /**
   * Get effective permissions for a subject on a channel.
   */
  getEffectivePermissions(channelId: string, subjectId: string): Record<Permission, AclAction | "default"> {
    const result = {} as Record<Permission, AclAction | "default">;
    for (const perm of ALL_PERMISSIONS) {
      const entry = this.entries.find(
        (e) => e.channelId === channelId && e.subjectId === subjectId && e.permission === perm
      );
      result[perm] = entry ? entry.action : "default";
    }
    return result;
  }

  /**
   * Clear all ACL entries for a channel.
   */
  clearChannel(channelId: string): number {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.channelId !== channelId);
    return before - this.entries.length;
  }

  /**
   * Total number of ACL entries.
   */
  size(): number {
    return this.entries.length;
  }
}

/**
 * Validate a permission string.
 */
export function isValidPermission(perm: string): perm is Permission {
  return ALL_PERMISSIONS.includes(perm as Permission);
}

/**
 * Get all available permissions.
 */
export function getAllPermissions(): Permission[] {
  return [...ALL_PERMISSIONS];
}

/**
 * Format an ACL entry for display.
 */
export function formatAclEntry(entry: AclEntry): string {
  const actionEmoji = entry.action === "allow" ? "✅" : "🚫";
  return `${actionEmoji} ${entry.subjectType}:${entry.subjectId} → ${entry.permission}`;
}
