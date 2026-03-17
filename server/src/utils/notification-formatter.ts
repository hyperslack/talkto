/**
 * Notification formatting utilities — format notifications for display.
 *
 * Provides formatters for different notification types: mentions, replies,
 * reactions, channel events, and batched digests.
 */

export type NotificationType = "mention" | "reply" | "reaction" | "channel_invite" | "channel_archive" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  channelName: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationGroup {
  channelName: string;
  notifications: Notification[];
  unreadCount: number;
}

/** Get emoji icon for a notification type. */
export function notificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    mention: "💬",
    reply: "↩️",
    reaction: "👍",
    channel_invite: "📨",
    channel_archive: "📦",
    system: "🔔",
  };
  return icons[type];
}

/** Format a single notification for display. */
export function formatNotification(n: Notification): string {
  const icon = notificationIcon(n.type);
  const readMarker = n.isRead ? "" : "● ";
  const preview = n.content.length > 80 ? n.content.slice(0, 77) + "..." : n.content;
  return `${readMarker}${icon} #${n.channelName} — ${n.senderName}: ${preview}`;
}

/** Group notifications by channel. */
export function groupByChannel(notifications: Notification[]): NotificationGroup[] {
  const map = new Map<string, Notification[]>();
  for (const n of notifications) {
    const list = map.get(n.channelName) ?? [];
    list.push(n);
    map.set(n.channelName, list);
  }
  const groups: NotificationGroup[] = [];
  for (const [channelName, notifs] of map) {
    groups.push({
      channelName,
      notifications: notifs,
      unreadCount: notifs.filter((n) => !n.isRead).length,
    });
  }
  return groups.sort((a, b) => b.unreadCount - a.unreadCount);
}

/** Count unread notifications by type. */
export function countUnreadByType(notifications: Notification[]): Map<NotificationType, number> {
  const counts = new Map<NotificationType, number>();
  for (const n of notifications) {
    if (!n.isRead) {
      counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    }
  }
  return counts;
}

/** Format a batch digest summary. */
export function formatDigest(notifications: Notification[]): string {
  const groups = groupByChannel(notifications);
  const totalUnread = notifications.filter((n) => !n.isRead).length;
  const lines: string[] = [`📋 ${totalUnread} unread notification${totalUnread !== 1 ? "s" : ""}`];
  for (const group of groups) {
    if (group.unreadCount > 0) {
      lines.push(`  #${group.channelName}: ${group.unreadCount} new`);
    }
  }
  return lines.join("\n");
}

/** Get the most recent notification. */
export function mostRecent(notifications: Notification[]): Notification | null {
  if (notifications.length === 0) return null;
  return notifications.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
}

/** Filter notifications by type. */
export function filterByType(notifications: Notification[], type: NotificationType): Notification[] {
  return notifications.filter((n) => n.type === type);
}

/** Check if there are any unread notifications. */
export function hasUnread(notifications: Notification[]): boolean {
  return notifications.some((n) => !n.isRead);
}

/** Format badge text (e.g., "5" or "99+"). */
export function formatBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}
