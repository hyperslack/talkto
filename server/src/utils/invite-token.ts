/**
 * Invite token validation and formatting utilities.
 *
 * Validates invite tokens, checks expiry, formats invite URLs,
 * and manages usage limits.
 */

export interface InviteInfo {
  token: string;
  workspaceSlug: string;
  role: "admin" | "member";
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export type InviteStatus = "valid" | "expired" | "exhausted" | "revoked";

/** Check the status of an invite. */
export function getInviteStatus(invite: InviteInfo, now?: Date): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && new Date(invite.expiresAt) <= (now ?? new Date())) return "expired";
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return "exhausted";
  return "valid";
}

/** Check if an invite can still be used. */
export function isUsable(invite: InviteInfo, now?: Date): boolean {
  return getInviteStatus(invite, now) === "valid";
}

/** Build a full invite URL from a base URL and token. */
export function buildInviteUrl(baseUrl: string, token: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return `${normalized}/invite/${token}`;
}

/** Parse a token from an invite URL. Returns null if invalid. */
export function parseInviteUrl(url: string): string | null {
  const match = url.match(/\/invite\/([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}

/** Calculate remaining uses. Returns null if unlimited. */
export function remainingUses(invite: InviteInfo): number | null {
  if (invite.maxUses === null) return null;
  return Math.max(0, invite.maxUses - invite.useCount);
}

/** Format invite info for display. */
export function formatInviteInfo(invite: InviteInfo): string {
  const status = getInviteStatus(invite);
  const uses = invite.maxUses !== null ? `${invite.useCount}/${invite.maxUses}` : `${invite.useCount}/∞`;
  const expiry = invite.expiresAt ? `expires ${invite.expiresAt}` : "no expiry";
  return `[${status.toUpperCase()}] ${invite.workspaceSlug} (${invite.role}) — ${uses} uses, ${expiry}`;
}

/** Check if a token string looks valid (alphanumeric + hyphens/underscores, min 8 chars). */
export function isValidTokenFormat(token: string): boolean {
  return /^[a-zA-Z0-9_-]{8,}$/.test(token);
}

/** Calculate time until expiry in milliseconds. Returns null if no expiry. Returns 0 if expired. */
export function timeUntilExpiry(invite: InviteInfo, now?: Date): number | null {
  if (!invite.expiresAt) return null;
  const diff = new Date(invite.expiresAt).getTime() - (now ?? new Date()).getTime();
  return Math.max(0, diff);
}
