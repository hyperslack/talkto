/**
 * Channel moderator role utilities.
 *
 * Manages per-channel moderator assignments and permission checks.
 * Moderators can pin/unpin messages, delete messages, and manage channel settings.
 */

export type ChannelRole = "owner" | "moderator" | "member";

export interface ChannelRoleEntry {
  userId: string;
  channelId: string;
  role: ChannelRole;
  assignedBy: string;
  assignedAt: number;
}

export type ModeratorAction =
  | "pin_message"
  | "unpin_message"
  | "delete_message"
  | "edit_topic"
  | "mute_user"
  | "kick_user";

/**
 * In-memory channel role store.
 */
export class ChannelRoleStore {
  private roles: Map<string, Map<string, ChannelRoleEntry>> = new Map(); // channelId → userId → entry

  /**
   * Set a user's role in a channel.
   */
  setRole(channelId: string, userId: string, role: ChannelRole, assignedBy: string): ChannelRoleEntry {
    if (!this.roles.has(channelId)) {
      this.roles.set(channelId, new Map());
    }
    const entry: ChannelRoleEntry = {
      userId,
      channelId,
      role,
      assignedBy,
      assignedAt: Date.now(),
    };
    this.roles.get(channelId)!.set(userId, entry);
    return entry;
  }

  /**
   * Get a user's role in a channel. Returns "member" if not explicitly set.
   */
  getRole(channelId: string, userId: string): ChannelRole {
    return this.roles.get(channelId)?.get(userId)?.role ?? "member";
  }

  /**
   * Remove a user's explicit role (reverts to member).
   */
  removeRole(channelId: string, userId: string): boolean {
    return this.roles.get(channelId)?.delete(userId) ?? false;
  }

  /**
   * List all moderators and owners in a channel.
   */
  listPrivileged(channelId: string): ChannelRoleEntry[] {
    const channelRoles = this.roles.get(channelId);
    if (!channelRoles) return [];
    return Array.from(channelRoles.values()).filter(
      (e) => e.role === "owner" || e.role === "moderator"
    );
  }

  /**
   * Count moderators in a channel.
   */
  moderatorCount(channelId: string): number {
    return this.listPrivileged(channelId).filter((e) => e.role === "moderator").length;
  }
}

/**
 * Permission matrix: which roles can perform which actions.
 */
const PERMISSIONS: Record<ModeratorAction, ChannelRole[]> = {
  pin_message: ["owner", "moderator"],
  unpin_message: ["owner", "moderator"],
  delete_message: ["owner", "moderator"],
  edit_topic: ["owner", "moderator"],
  mute_user: ["owner", "moderator"],
  kick_user: ["owner"],
};

/**
 * Check if a role can perform an action.
 */
export function canPerform(role: ChannelRole, action: ModeratorAction): boolean {
  return PERMISSIONS[action]?.includes(role) ?? false;
}

/**
 * Check if a user can perform an action in a channel.
 */
export function userCanPerform(
  store: ChannelRoleStore,
  channelId: string,
  userId: string,
  action: ModeratorAction
): boolean {
  const role = store.getRole(channelId, userId);
  return canPerform(role, action);
}

/**
 * Get a display label for a role.
 */
export function roleLabel(role: ChannelRole): string {
  switch (role) {
    case "owner": return "👑 Owner";
    case "moderator": return "🛡️ Moderator";
    case "member": return "Member";
  }
}
