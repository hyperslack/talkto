/**
 * Workspace data export — export all workspace data as a JSON structure.
 *
 * Useful for backups, migration, and compliance.
 */

import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import { workspaces, channels, messages, users, agents, channelMembers, workspaceMembers } from "../db/schema";

export interface WorkspaceExport {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: string;
    description: string | null;
    created_at: string;
  };
  members: Array<{
    user_id: string;
    user_name: string;
    user_type: string;
    role: string;
    joined_at: string;
  }>;
  channels: Array<{
    id: string;
    name: string;
    type: string;
    topic: string | null;
    created_at: string;
    message_count: number;
  }>;
  messages: Array<{
    id: string;
    channel_name: string;
    sender_name: string;
    sender_type: string;
    content: string;
    created_at: string;
    parent_id: string | null;
  }>;
  agents: Array<{
    agent_name: string;
    agent_type: string;
    project_name: string;
    status: string;
    description: string | null;
  }>;
  exported_at: string;
  total_messages: number;
  total_channels: number;
  total_members: number;
}

/**
 * Export all data for a workspace.
 * @param maxMessages Cap on messages to export (default 10000)
 */
export function exportWorkspace(workspaceId: string, maxMessages: number = 10000): WorkspaceExport | null {
  const db = getDb();

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return null;

  // Members
  const memberRows = db
    .select({
      userId: workspaceMembers.userId,
      userName: users.name,
      userType: users.type,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .all();

  // Channels with message counts
  const channelRows = db
    .select({
      id: channels.id,
      name: channels.name,
      type: channels.type,
      topic: channels.topic,
      createdAt: channels.createdAt,
    })
    .from(channels)
    .where(eq(channels.workspaceId, workspaceId))
    .all();

  const channelIds = channelRows.map((c) => c.id);
  const channelData = channelRows.map((ch) => {
    const count = db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM messages WHERE channel_id = ${ch.id}`
    );
    return {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      topic: ch.topic,
      created_at: ch.createdAt,
      message_count: count?.count ?? 0,
    };
  });

  // Messages (capped)
  const msgRows = channelIds.length > 0
    ? db
        .select({
          id: messages.id,
          channelName: channels.name,
          senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
          senderType: users.type,
          content: messages.content,
          createdAt: messages.createdAt,
          parentId: messages.parentId,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .innerJoin(channels, eq(messages.channelId, channels.id))
        .where(eq(channels.workspaceId, workspaceId))
        .orderBy(messages.createdAt)
        .limit(maxMessages)
        .all()
    : [];

  // Agents
  const agentRows = db
    .select({
      agentName: agents.agentName,
      agentType: agents.agentType,
      projectName: agents.projectName,
      status: agents.status,
      description: agents.description,
    })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
    .all();

  return {
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      type: ws.type,
      description: ws.description,
      created_at: ws.createdAt,
    },
    members: memberRows.map((m) => ({
      user_id: m.userId,
      user_name: m.userName,
      user_type: m.userType,
      role: m.role,
      joined_at: m.joinedAt,
    })),
    channels: channelData,
    messages: msgRows.map((m) => ({
      id: m.id,
      channel_name: m.channelName,
      sender_name: m.senderName,
      sender_type: m.senderType,
      content: m.content,
      created_at: m.createdAt,
      parent_id: m.parentId,
    })),
    agents: agentRows.map((a) => ({
      agent_name: a.agentName,
      agent_type: a.agentType,
      project_name: a.projectName,
      status: a.status,
      description: a.description,
    })),
    exported_at: new Date().toISOString(),
    total_messages: msgRows.length,
    total_channels: channelData.length,
    total_members: memberRows.length,
  };
}
