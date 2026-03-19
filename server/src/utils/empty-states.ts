/**
 * Empty state content utilities — provides contextual messages and hints
 * for empty views (no messages, no channels, no agents, etc.).
 *
 * Each empty state includes a title, description, emoji, and optional
 * action hints to guide users on what to do next.
 */

export interface EmptyStateContent {
  emoji: string;
  title: string;
  description: string;
  actionHint?: string;
}

export type EmptyStateKind =
  | "no_messages"
  | "no_channels"
  | "no_agents"
  | "no_search_results"
  | "no_pinned_messages"
  | "no_threads"
  | "no_bookmarks"
  | "no_members"
  | "channel_archived"
  | "no_reactions"
  | "no_notifications";

const EMPTY_STATES: Record<EmptyStateKind, EmptyStateContent> = {
  no_messages: {
    emoji: "💬",
    title: "No messages yet",
    description: "This channel is waiting for its first message.",
    actionHint: "Type a message below or @mention an agent to get started.",
  },
  no_channels: {
    emoji: "📁",
    title: "No channels",
    description: "Your workspace doesn't have any channels yet.",
    actionHint: "Create a channel to start organizing conversations.",
  },
  no_agents: {
    emoji: "🤖",
    title: "No agents connected",
    description: "No AI agents are currently available in this workspace.",
    actionHint: "Connect an agent using the CLI to start collaborating.",
  },
  no_search_results: {
    emoji: "🔍",
    title: "No results found",
    description: "Your search didn't match any messages.",
    actionHint: "Try different keywords or broaden your search.",
  },
  no_pinned_messages: {
    emoji: "📌",
    title: "No pinned messages",
    description: "Pin important messages to find them quickly.",
    actionHint: "Hover over a message and click the pin icon.",
  },
  no_threads: {
    emoji: "🧵",
    title: "No threads",
    description: "No threaded conversations in this channel yet.",
    actionHint: "Reply to a message to start a thread.",
  },
  no_bookmarks: {
    emoji: "🔖",
    title: "No bookmarks",
    description: "You haven't bookmarked any messages yet.",
    actionHint: "Bookmark messages you want to come back to later.",
  },
  no_members: {
    emoji: "👥",
    title: "No members",
    description: "This channel has no members yet.",
    actionHint: "Invite people to join this channel.",
  },
  channel_archived: {
    emoji: "📦",
    title: "Channel archived",
    description: "This channel has been archived and is read-only.",
    actionHint: "Unarchive the channel to resume conversations.",
  },
  no_reactions: {
    emoji: "😶",
    title: "No reactions yet",
    description: "No one has reacted to messages in this channel.",
    actionHint: "React to a message with an emoji to get started.",
  },
  no_notifications: {
    emoji: "🔔",
    title: "All caught up!",
    description: "You have no new notifications.",
  },
};

/**
 * Get empty state content for a given view/context.
 */
export function getEmptyState(kind: EmptyStateKind): EmptyStateContent {
  return EMPTY_STATES[kind];
}

/**
 * Get all available empty state kinds.
 */
export function getAvailableKinds(): EmptyStateKind[] {
  return Object.keys(EMPTY_STATES) as EmptyStateKind[];
}

/**
 * Format an empty state as a single-line display string.
 */
export function formatEmptyState(kind: EmptyStateKind): string {
  const state = EMPTY_STATES[kind];
  return `${state.emoji} ${state.title} — ${state.description}`;
}

/**
 * Get a contextual empty state for a channel based on its properties.
 */
export function getChannelEmptyState(channel: {
  is_archived?: boolean;
  type?: string;
}): EmptyStateContent {
  if (channel.is_archived) return EMPTY_STATES.channel_archived;
  return EMPTY_STATES.no_messages;
}

/**
 * Check if a kind is a valid empty state.
 */
export function isValidEmptyStateKind(kind: string): kind is EmptyStateKind {
  return kind in EMPTY_STATES;
}
