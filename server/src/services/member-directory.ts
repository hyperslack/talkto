/**
 * Member directory — enriched workspace member listing with stats.
 *
 * Provides a richer view of workspace members including message counts,
 * last activity, and channel membership.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface MemberDirectoryEntry {
  user_id: string;
  name: string;
  display_name: string | null;
  type: string;
  role: string;
  message_count: number;
  last_message_at: string | null;
  channel_count: number;
  joined_at: string;
  status_emoji: string | null;
  status_text: string | null;
}

/** Get enriched member directory for a workspace. */
export function getMemberDirectory(workspaceId: string): MemberDirectoryEntry[] {
  const db = getDb();

  const rows = db.all(sql`
    SELECT
      u.id as user_id,
      u.name,
      u.display_name,
      u.type,
      wm.role,
      wm.joined_at,
      u.status_emoji,
      u.status_text,
      COALESCE(msg_stats.message_count, 0) as message_count,
      msg_stats.last_message_at,
      COALESCE(ch_stats.channel_count, 0) as channel_count
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    LEFT JOIN (
      SELECT sender_id, COUNT(*) as message_count, MAX(messages.created_at) as last_message_at
      FROM messages
      JOIN channels ON messages.channel_id = channels.id
      WHERE channels.workspace_id = ${workspaceId}
      GROUP BY sender_id
    ) msg_stats ON msg_stats.sender_id = u.id
    LEFT JOIN (
      SELECT cm.user_id, COUNT(DISTINCT cm.channel_id) as channel_count
      FROM channel_members cm
      JOIN channels c ON cm.channel_id = c.id
      WHERE c.workspace_id = ${workspaceId}
      GROUP BY cm.user_id
    ) ch_stats ON ch_stats.user_id = u.id
    WHERE wm.workspace_id = ${workspaceId}
    ORDER BY COALESCE(msg_stats.message_count, 0) DESC, u.name ASC
  `) as MemberDirectoryEntry[];

  return rows;
}
