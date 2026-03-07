/**
 * Admin-only workspace mutations for channels and agents.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  agents,
  channelMembers,
  channels,
  messageReactions,
  messages,
  readReceipts,
  sessions,
  users,
  workspaceMembers,
} from "../db/schema";
import {
  agentDeletedEvent,
  agentUpdatedEvent,
  broadcastEvent,
  channelDeletedEvent,
} from "./broadcaster";

const MANAGED_AGENT_TYPES = ["opencode", "claude_code", "codex", "cursor", "system"] as const;
const MANAGED_GENDERS = ["male", "female", "non-binary"] as const;

type ManagedAgentType = (typeof MANAGED_AGENT_TYPES)[number];
type ManagedGender = (typeof MANAGED_GENDERS)[number];

function validateGender(gender?: string | null): string | null | undefined {
  if (gender === undefined) return undefined;
  if (gender === null || gender === "") return null;
  if ((MANAGED_GENDERS as readonly string[]).includes(gender)) {
    return gender;
  }
  return undefined;
}

function validateAgentType(agentType?: string): ManagedAgentType | undefined {
  if (!agentType) return undefined;
  if ((MANAGED_AGENT_TYPES as readonly string[]).includes(agentType)) {
    return agentType as ManagedAgentType;
  }
  return undefined;
}

export function deleteChannelGraph(channel: typeof channels.$inferSelect): Record<string, unknown> {
  const db = getDb();
  const messageIds = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.channelId, channel.id))
    .all()
    .map((row) => row.id);

  if (messageIds.length > 0) {
    db.delete(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds))
      .run();
  }

  db.delete(messages).where(eq(messages.channelId, channel.id)).run();
  db.delete(readReceipts).where(eq(readReceipts.channelId, channel.id)).run();
  db.delete(channelMembers).where(eq(channelMembers.channelId, channel.id)).run();
  db.delete(channels).where(eq(channels.id, channel.id)).run();

  broadcastEvent(
    channelDeletedEvent({
      channelId: channel.id,
      channelName: channel.name,
    }),
    channel.workspaceId
  );

  return {
    deleted: true,
    id: channel.id,
    name: channel.name,
  };
}

export function updateAgentAdminProfile(
  agent: typeof agents.$inferSelect,
  updates: {
    description?: string | null;
    personality?: string | null;
    currentTask?: string | null;
    gender?: string | null;
    agentType?: string;
  }
): Record<string, unknown> {
  const db = getDb();
  const normalizedGender = validateGender(updates.gender);
  if (updates.gender !== undefined && normalizedGender === undefined) {
    return { error: "Gender must be 'male', 'female', or 'non-binary'." };
  }

  const normalizedAgentType = validateAgentType(updates.agentType);
  if (updates.agentType !== undefined && normalizedAgentType === undefined) {
    return { error: "agent_type must be one of opencode, claude_code, codex, cursor, or system." };
  }

  if (agent.agentType === "system" && normalizedAgentType && normalizedAgentType !== "system") {
    return { error: "System agents cannot be reassigned to another provider type." };
  }

  if (agent.agentType !== "system" && normalizedAgentType === "system") {
    return { error: "Only built-in system agents may use agent_type='system'." };
  }

  const patch: Partial<typeof agents.$inferInsert> = {};
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.personality !== undefined) patch.personality = updates.personality;
  if (updates.currentTask !== undefined) patch.currentTask = updates.currentTask;
  if (normalizedGender !== undefined) patch.gender = normalizedGender as ManagedGender | null;
  if (normalizedAgentType !== undefined) {
    patch.agentType = normalizedAgentType;
    if (normalizedAgentType !== agent.agentType) {
      // Provider changes invalidate any stored invocation session metadata.
      // The agent must re-register under the new provider type.
      patch.providerSessionId = null;
      patch.serverUrl = null;
      patch.status = "offline";
    } else if (normalizedAgentType !== "opencode") {
      patch.serverUrl = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return {
      status: "updated",
      agent_name: agent.agentName,
      agent_type: agent.agentType,
      description: agent.description,
      personality: agent.personality,
      current_task: agent.currentTask,
      gender: agent.gender,
    };
  }

  db.update(agents).set(patch).where(eq(agents.id, agent.id)).run();
  const updated = db.select().from(agents).where(eq(agents.id, agent.id)).get()!;

  broadcastEvent(
    agentUpdatedEvent({
      agentId: updated.id,
      agentName: updated.agentName,
      agentType: updated.agentType,
      projectName: updated.projectName,
      description: updated.description,
      personality: updated.personality,
      currentTask: updated.currentTask,
      gender: updated.gender,
    }),
    updated.workspaceId
  );

  return {
    status: "updated",
    agent_name: updated.agentName,
    agent_type: updated.agentType,
    description: updated.description,
    personality: updated.personality,
    current_task: updated.currentTask,
    gender: updated.gender,
  };
}

export function deleteAgentFromWorkspace(agent: typeof agents.$inferSelect): Record<string, unknown> {
  if (agent.agentType === "system") {
    return { error: "System agents cannot be deleted." };
  }

  const db = getDb();
  const dmChannels = db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.workspaceId, agent.workspaceId),
        eq(channels.type, "dm"),
        eq(channels.name, `#dm-${agent.agentName}`)
      )
    )
    .all();

  for (const dmChannel of dmChannels) {
    deleteChannelGraph(dmChannel);
  }

  db.delete(readReceipts).where(eq(readReceipts.userId, agent.id)).run();
  db.delete(channelMembers).where(eq(channelMembers.userId, agent.id)).run();
  db.delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, agent.id),
        eq(workspaceMembers.workspaceId, agent.workspaceId)
      )
    )
    .run();
  db.delete(sessions).where(eq(sessions.agentId, agent.id)).run();
  db.delete(agents).where(eq(agents.id, agent.id)).run();

  const historicalName = `[deleted agent] ${agent.agentName}`;
  db.update(users)
    .set({
      name: historicalName,
      displayName: historicalName,
    })
    .where(eq(users.id, agent.id))
    .run();

  broadcastEvent(
    agentDeletedEvent({
      agentId: agent.id,
      agentName: agent.agentName,
    }),
    agent.workspaceId
  );

  return {
    deleted: true,
    id: agent.id,
    agent_name: agent.agentName,
  };
}
