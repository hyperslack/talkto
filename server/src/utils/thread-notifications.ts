/**
 * Thread notification utilities.
 *
 * Determines who should be notified when a new reply is posted in a thread,
 * based on thread participation, mentions, and user preferences.
 */

export interface ThreadParticipant {
  userId: string;
  name: string;
  /** Whether the user explicitly followed/unfollowed this thread */
  subscribed: boolean | null; // null = auto (participated)
  /** Whether user has posted in the thread */
  hasPosted: boolean;
  /** Whether user is the thread root author */
  isRootAuthor: boolean;
}

export type NotifyReason = "root_author" | "participant" | "mentioned" | "subscribed";

export interface ThreadNotification {
  userId: string;
  name: string;
  reasons: NotifyReason[];
}

/**
 * Determine which users should be notified about a new thread reply.
 * Excludes the sender of the new reply.
 */
export function computeNotifications(
  participants: ThreadParticipant[],
  mentionedUserIds: string[],
  senderId: string
): ThreadNotification[] {
  const notifications = new Map<string, ThreadNotification>();
  const mentionSet = new Set(mentionedUserIds);

  for (const p of participants) {
    // Skip the sender
    if (p.userId === senderId) continue;

    // Explicitly unsubscribed users get nothing (unless mentioned)
    if (p.subscribed === false && !mentionSet.has(p.userId)) continue;

    const reasons: NotifyReason[] = [];

    if (p.isRootAuthor) reasons.push("root_author");
    if (p.subscribed === true) reasons.push("subscribed");
    if (p.hasPosted && !p.isRootAuthor) reasons.push("participant");
    if (mentionSet.has(p.userId)) reasons.push("mentioned");

    if (reasons.length > 0) {
      notifications.set(p.userId, { userId: p.userId, name: p.name, reasons });
    }
  }

  // Also add mentioned users who aren't in participants list
  for (const uid of mentionedUserIds) {
    if (uid === senderId) continue;
    if (!notifications.has(uid)) {
      notifications.set(uid, { userId: uid, name: uid, reasons: ["mentioned"] });
    }
  }

  return Array.from(notifications.values());
}

/**
 * Get the highest priority reason for display purposes.
 */
export function primaryReason(reasons: NotifyReason[]): NotifyReason {
  const priority: NotifyReason[] = ["mentioned", "root_author", "subscribed", "participant"];
  for (const r of priority) {
    if (reasons.includes(r)) return r;
  }
  return reasons[0];
}

/**
 * Format a notification reason for display.
 */
export function formatReason(reason: NotifyReason): string {
  switch (reason) {
    case "root_author": return "replied to your message";
    case "participant": return "replied in a thread you participated in";
    case "mentioned": return "mentioned you in a thread";
    case "subscribed": return "new reply in a thread you follow";
  }
}

/**
 * Check if a user should receive a thread notification based on their preferences.
 */
export function shouldNotifyUser(
  notification: ThreadNotification,
  userPref: "all" | "mentions_only" | "none"
): boolean {
  if (userPref === "none") return false;
  if (userPref === "all") return true;
  // mentions_only: only if mentioned or is root author
  return notification.reasons.includes("mentioned") || notification.reasons.includes("root_author");
}
