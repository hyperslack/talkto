/**
 * Channel member role management — assign roles within channels.
 *
 * Supports owner, moderator, and member roles with permission checks.
 */

export type ChannelRole = "owner" | "moderator" | "member";

export type ChannelPermission =
  | "delete_message"
  | "pin_message"
  | "edit_topic"
  | "kick_member"
  | "manage_roles"
  | "mute_member";

const ROLE_PERMISSIONS: Record<ChannelRole, Set<ChannelPermission>> = {
  owner: new Set(["delete_message", "pin_message", "edit_topic", "kick_member", "manage_roles", "mute_member"]),
  moderator: new Set(["delete_message", "pin_message", "edit_topic", "mute_member"]),
  member: new Set([]),
};

const ROLE_HIERARCHY: Record<ChannelRole, number> = {
  owner: 3,
  moderator: 2,
  member: 1,
};

export interface ChannelMemberRole {
  channelId: string;
  userId: string;
  role: ChannelRole;
  assignedAt: string;
  assignedBy: string;
}

export class ChannelMemberRoleStore {
  private roles: Map<string, ChannelMemberRole> = new Map();

  private key(channelId: string, userId: string): string {
    return `${channelId}:${userId}`;
  }

  /** Assign a role to a user in a channel. */
  assign(channelId: string, userId: string, role: ChannelRole, assignedBy: string): ChannelMemberRole {
    const entry: ChannelMemberRole = {
      channelId,
      userId,
      role,
      assignedAt: new Date().toISOString(),
      assignedBy,
    };
    this.roles.set(this.key(channelId, userId), entry);
    return entry;
  }

  /** Remove a role assignment (user reverts to implicit member). */
  remove(channelId: string, userId: string): boolean {
    return this.roles.delete(this.key(channelId, userId));
  }

  /** Get a user's role in a channel (defaults to "member"). */
  getRole(channelId: string, userId: string): ChannelRole {
    return this.roles.get(this.key(channelId, userId))?.role ?? "member";
  }

  /** Check if a user has a specific permission in a channel. */
  hasPermission(channelId: string, userId: string, permission: ChannelPermission): boolean {
    const role = this.getRole(channelId, userId);
    return ROLE_PERMISSIONS[role].has(permission);
  }

  /** List all role assignments for a channel. */
  listByChannel(channelId: string): ChannelMemberRole[] {
    const results: ChannelMemberRole[] = [];
    for (const entry of this.roles.values()) {
      if (entry.channelId === channelId) results.push(entry);
    }
    return results.sort((a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]);
  }

  /** List all channels where a user has an explicit role. */
  listByUser(userId: string): ChannelMemberRole[] {
    const results: ChannelMemberRole[] = [];
    for (const entry of this.roles.values()) {
      if (entry.userId === userId) results.push(entry);
    }
    return results;
  }

  /** Check if one role outranks another. */
  outranks(role1: ChannelRole, role2: ChannelRole): boolean {
    return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
  }

  /** Get all permissions for a role. */
  getPermissions(role: ChannelRole): ChannelPermission[] {
    return Array.from(ROLE_PERMISSIONS[role]);
  }

  /** Count users by role in a channel. */
  countByRole(channelId: string): Record<ChannelRole, number> {
    const counts: Record<ChannelRole, number> = { owner: 0, moderator: 0, member: 0 };
    for (const entry of this.roles.values()) {
      if (entry.channelId === channelId) counts[entry.role]++;
    }
    return counts;
  }

  /** Clear all data (for testing). */
  clear(): void {
    this.roles.clear();
  }
}
