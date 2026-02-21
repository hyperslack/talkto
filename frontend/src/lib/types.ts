/** Shared TypeScript types matching the backend Pydantic schemas. */

export interface User {
  id: string;
  name: string;
  type: "human" | "agent";
  created_at: string;
  display_name: string | null;
  about: string | null;
  agent_instructions: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface UserOnboardPayload {
  name: string;
  display_name?: string;
  about?: string;
  agent_instructions?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: "general" | "project" | "custom" | "dm";
  topic?: string | null;
  project_path: string | null;
  created_by: string;
  created_at: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_type: "human" | "agent" | null;
  content: string;
  mentions: string[] | null;
  parent_id: string | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  edited_at?: string | null;
  reactions?: MessageReaction[];
  created_at: string;
}

export interface Agent {
  id: string;
  agent_name: string;
  agent_type: string;
  project_path: string;
  project_name: string;
  status: "online" | "offline";
  description: string | null;
  personality: string | null;
  current_task: string | null;
  gender: string | null;
  server_url: string | null;
  provider_session_id: string | null;
  is_ghost: boolean;
  message_count?: number;
  last_message_at?: string | null;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  status: string;
  reason?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  vote_count: number;
}

// ── Workspace ──────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "shared";
  description: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface WorkspaceMember {
  user_id: string;
  user_name: string;
  display_name: string | null;
  user_type: "human" | "agent";
  role: "admin" | "member";
  joined_at: string;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  key_prefix: string;
  name: string | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface ApiKeyCreated extends ApiKey {
  raw_key: string;
}

export interface Invite {
  id: string;
  workspace_id: string;
  token: string;
  role: "admin" | "member";
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
  invite_url?: string;
}

export interface AuthInfo {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
    display_name: string | null;
    type: string;
    email: string | null;
    avatar_url: string | null;
  };
  workspace_id: string;
  role: "admin" | "member" | "none";
  auth_method: "session" | "apikey" | "localhost";
}

export interface JoinResult {
  ok: boolean;
  user_id: string;
  workspace_id: string;
  role: string;
  is_new_user: boolean;
}

/** WebSocket event types received from the server. */
export type WSEventType =
  | "new_message"
  | "message_deleted"
  | "message_edited"
  | "agent_status"
  | "agent_typing"
  | "agent_streaming"
  | "channel_created"
  | "feature_update"
  | "subscribed"
  | "unsubscribed"
  | "reaction"
  | "pong"
  | "error";

export interface WSEvent<T = unknown> {
  type: WSEventType;
  data: T;
}

export interface WSNewMessageData {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: "human" | "agent";
  content: string;
  mentions: string[];
  parent_id: string | null;
  edited_at?: string | null;
  created_at: string;
}

export interface WSMessageDeletedData {
  id: string;
  channel_id: string;
}

export interface WSMessageEditedData {
  id: string;
  channel_id: string;
  content: string;
  edited_at: string;
}

export interface WSReactionData {
  message_id: string;
  channel_id: string;
  emoji: string;
  user_name: string;
  action: "add" | "remove";
}

export interface WSAgentStatusData {
  agent_name: string;
  status: "online" | "offline";
  agent_type: string;
  project_name: string;
}

export interface WSAgentTypingData {
  agent_name: string;
  channel_id: string;
  is_typing: boolean;
  error?: string;
}

export interface WSAgentStreamingData {
  agent_name: string;
  channel_id: string;
  delta: string;
}

export interface WSChannelCreatedData {
  id: string;
  name: string;
  type: string;
  project_path: string | null;
}

export interface WSFeatureUpdateData {
  id: string;
  title: string;
  status: string;
  vote_count: number;
  update_type: "created" | "voted" | "status_changed" | "deleted";
}
