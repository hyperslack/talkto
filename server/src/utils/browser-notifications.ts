/**
 * Browser notification utilities — builds notification payloads and
 * manages notification preferences for desktop/browser notifications.
 *
 * Determines when to show notifications based on user focus state,
 * mention detection, and per-channel mute preferences.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export interface NotificationContext {
  /** Is the user currently focused on the app tab? */
  isFocused: boolean;
  /** Is the user viewing this specific channel? */
  isActiveChannel: boolean;
  /** Channel IDs the user has muted. */
  mutedChannels: Set<string>;
  /** Global notification preference. */
  enabled: boolean;
}

export interface IncomingMessage {
  id: string;
  channel_id: string;
  channel_name?: string;
  sender_name: string;
  sender_type: "human" | "agent";
  content: string;
  mentions?: string[];
}

/**
 * Determine if a notification should be shown for a message.
 */
export function shouldNotify(
  message: IncomingMessage,
  context: NotificationContext,
  currentUserName?: string,
): boolean {
  if (!context.enabled) return false;
  if (context.mutedChannels.has(message.channel_id)) return false;
  if (context.isActiveChannel && context.isFocused) return false;

  // Always notify on direct mentions
  if (currentUserName && message.mentions?.includes(currentUserName)) return true;

  // Notify if not focused
  if (!context.isFocused) return true;

  // Focused but on a different channel — notify
  if (!context.isActiveChannel) return true;

  return false;
}

/**
 * Build a notification payload from an incoming message.
 */
export function buildNotificationPayload(message: IncomingMessage): NotificationPayload {
  const channelLabel = message.channel_name ?? "a channel";
  const senderLabel = message.sender_type === "agent"
    ? `🤖 ${message.sender_name}`
    : message.sender_name;

  const body = truncateBody(message.content, 100);

  return {
    title: `${senderLabel} in #${channelLabel}`,
    body,
    tag: `talkto-${message.channel_id}-${message.id}`,
    data: {
      channelId: message.channel_id,
      messageId: message.id,
    },
  };
}

/**
 * Truncate notification body text to a max length.
 */
function truncateBody(text: string, maxLen: number): string {
  const clean = text.replace(/\n+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + "…";
}

/**
 * Check if a message contains a mention of the current user.
 */
export function isMentioned(message: IncomingMessage, userName: string): boolean {
  if (!message.mentions || message.mentions.length === 0) return false;
  return message.mentions.includes(userName);
}

/**
 * Generate a document title with unread count badge.
 */
export function buildDocumentTitle(unreadCount: number, baseName: string = "TalkTo"): string {
  if (unreadCount <= 0) return baseName;
  if (unreadCount > 99) return `(99+) ${baseName}`;
  return `(${unreadCount}) ${baseName}`;
}

/**
 * Create a default notification context (all notifications enabled, nothing muted).
 */
export function defaultContext(): NotificationContext {
  return {
    isFocused: true,
    isActiveChannel: false,
    mutedChannels: new Set(),
    enabled: true,
  };
}
