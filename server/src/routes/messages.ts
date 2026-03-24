/**
 * Message endpoints — GET (with cursor pagination), POST (human sends), DELETE.
 */

import { Hono } from "hono";
import { eq, desc, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { channels, channelSessions, messages, users, messageReactions } from "../db/schema";
import { z } from "zod";
import { MessageCreateSchema, MessageEditSchema, ReactionToggleSchema } from "../types";
import { broadcastEvent, newMessageEvent, messageDeletedEvent, messageEditedEvent, reactionEvent } from "../services/broadcaster";
import { invokeForMessage } from "../services/agent-invoker";
import {
  attachRootMessageToSession,
  cleanupChannelSessionAfterMessageDelete,
  resolveChannelSessionForWrite,
} from "../services/channel-sessions";
import type {
  AppBindings,
  ChannelSessionHistoryResponse,
  ChannelSessionSummaryResponse,
  MessageResponse,
} from "../types";
import { and } from "drizzle-orm";

const app = new Hono<AppBindings>();

/** Safely parse JSON body, returning null on malformed input */
async function safeJsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/** Look up a channel by ID scoped to a workspace. Returns null if not found or wrong workspace. */
function getChannelInWorkspace(channelId: string, workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, workspaceId)))
    .get() ?? null;
}

function getReactionsByMessage(messageIds: string[]) {
  const db = getDb();
  const allReactions = messageIds.length > 0
    ? db
        .select({
          messageId: messageReactions.messageId,
          emoji: messageReactions.emoji,
          userName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
        })
        .from(messageReactions)
        .innerJoin(users, eq(messageReactions.userId, users.id))
        .where(sql`${messageReactions.messageId} IN (${sql.join(messageIds.map((id) => sql`${id}`), sql`, `)})`)
        .all()
    : [];

  const reactionsByMessage = new Map<string, Map<string, string[]>>();
  for (const reaction of allReactions) {
    if (!reactionsByMessage.has(reaction.messageId)) {
      reactionsByMessage.set(reaction.messageId, new Map());
    }
    const emojiMap = reactionsByMessage.get(reaction.messageId)!;
    const userList = emojiMap.get(reaction.emoji) ?? [];
    userList.push(reaction.userName);
    emojiMap.set(reaction.emoji, userList);
  }

  return reactionsByMessage;
}

function mapMessageRows(
  rows: Array<{
    id: string;
    channelId: string;
    channelSessionId: string | null;
    senderId: string;
    senderName: string;
    senderType: string;
    content: string;
    mentions: string | null;
    parentId: string | null;
    isPinned: number;
    pinnedAt: string | null;
    pinnedBy: string | null;
    editedAt: string | null;
    replyCount?: number | null;
    createdAt: string;
  }>
): MessageResponse[] {
  const reactionsByMessage = getReactionsByMessage(rows.map((row) => row.id));

  return rows.map((row) => {
    const emojiMap = reactionsByMessage.get(row.id);
    const reactions = emojiMap
      ? Array.from(emojiMap.entries()).map(([emoji, userNames]) => ({
          emoji,
          users: userNames,
          count: userNames.length,
        }))
      : [];

    return {
      id: row.id,
      channel_id: row.channelId,
      channel_session_id: row.channelSessionId,
      sender_id: row.senderId,
      sender_name: row.senderName,
      sender_type: row.senderType,
      content: row.content,
      mentions: row.mentions ? JSON.parse(row.mentions) : null,
      parent_id: row.parentId,
      is_pinned: Boolean(row.isPinned),
      pinned_at: row.pinnedAt,
      pinned_by: row.pinnedBy,
      edited_at: row.editedAt,
      reply_count: row.replyCount ?? 0,
      reactions,
      created_at: row.createdAt,
    };
  });
}

// GET /channels/:channelId/messages
app.get("/", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 100);
  const before = c.req.query("before");
  const db = getDb();

  // Verify channel exists and belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Build query with coalesce for sender_name
  let query = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      channelSessionId: messages.channelSessionId,
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      mentions: messages.mentions,
      parentId: messages.parentId,
      isPinned: messages.isPinned,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      editedAt: messages.editedAt,
      replyCount: sql<number>`(SELECT count(*) FROM messages AS _rc WHERE _rc.parent_id = ${messages.id})`,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.channelId, channelId))
    .$dynamic();

  // Cursor pagination — use and() to preserve the channelId filter
  if (before) {
    const beforeMsg = db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, before))
      .get();
    if (beforeMsg) {
      query = query.where(
        and(eq(messages.channelId, channelId), lt(messages.createdAt, beforeMsg.createdAt))
      );
    }
  }

  const rows = query
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  return c.json(mapMessageRows(rows));
});

// GET /channels/:channelId/messages/sessions
app.get("/sessions", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const rows = db
    .select({
      id: channelSessions.id,
      channelId: channelSessions.channelId,
      rootMessageId: channelSessions.rootMessageId,
      startedById: channelSessions.rootSenderId,
      startedByName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      startedByType: users.type,
      rootPreview: channelSessions.rootPreview,
      startedAt: channelSessions.createdAt,
      messageCount: sql<number>`count(${messages.id})`,
      lastMessageAt: sql<string>`max(${messages.createdAt})`,
    })
    .from(channelSessions)
    .innerJoin(users, eq(channelSessions.rootSenderId, users.id))
    .leftJoin(messages, eq(messages.channelSessionId, channelSessions.id))
    .where(eq(channelSessions.channelId, channelId))
    .groupBy(
      channelSessions.id,
      channelSessions.channelId,
      channelSessions.rootMessageId,
      channelSessions.rootSenderId,
      users.displayName,
      users.name,
      users.type,
      channelSessions.rootPreview,
      channelSessions.createdAt
    )
    .orderBy(desc(sql`max(${messages.createdAt})`), desc(channelSessions.createdAt))
    .all();

  const result: ChannelSessionSummaryResponse[] = rows.map((row) => ({
    id: row.id,
    channel_id: row.channelId,
    root_message_id: row.rootMessageId,
    started_by_id: row.startedById,
    started_by_name: row.startedByName,
    started_by_type: row.startedByType,
    root_preview: row.rootPreview,
    message_count: row.messageCount ?? 0,
    started_at: row.startedAt,
    last_message_at: row.lastMessageAt ?? row.startedAt,
  }));

  return c.json(result);
});

// GET /channels/:channelId/messages/sessions/:sessionId
app.get("/sessions/:sessionId", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const sessionId = c.req.param("sessionId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const session = db
    .select({
      id: channelSessions.id,
      channelId: channelSessions.channelId,
      rootMessageId: channelSessions.rootMessageId,
      startedById: channelSessions.rootSenderId,
      startedByName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      startedByType: users.type,
      rootPreview: channelSessions.rootPreview,
      startedAt: channelSessions.createdAt,
      messageCount: sql<number>`count(${messages.id})`,
      lastMessageAt: sql<string>`max(${messages.createdAt})`,
    })
    .from(channelSessions)
    .innerJoin(users, eq(channelSessions.rootSenderId, users.id))
    .leftJoin(messages, eq(messages.channelSessionId, channelSessions.id))
    .where(and(eq(channelSessions.id, sessionId), eq(channelSessions.channelId, channelId)))
    .groupBy(
      channelSessions.id,
      channelSessions.channelId,
      channelSessions.rootMessageId,
      channelSessions.rootSenderId,
      users.displayName,
      users.name,
      users.type,
      channelSessions.rootPreview,
      channelSessions.createdAt
    )
    .get();

  if (!session) {
    return c.json({ detail: "Session not found" }, 404);
  }

  const rows = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      channelSessionId: messages.channelSessionId,
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      mentions: messages.mentions,
      parentId: messages.parentId,
      isPinned: messages.isPinned,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      editedAt: messages.editedAt,
      replyCount: sql<number>`(SELECT count(*) FROM messages AS _rc WHERE _rc.parent_id = ${messages.id})`,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(eq(messages.channelId, channelId), eq(messages.channelSessionId, sessionId)))
    .orderBy(messages.createdAt)
    .all();

  const result: ChannelSessionHistoryResponse = {
    id: session.id,
    channel_id: session.channelId,
    root_message_id: session.rootMessageId,
    started_by_id: session.startedById,
    started_by_name: session.startedByName,
    started_by_type: session.startedByType,
    root_preview: session.rootPreview,
    message_count: session.messageCount ?? 0,
    started_at: session.startedAt,
    last_message_at: session.lastMessageAt ?? session.startedAt,
    messages: mapMessageRows(rows),
  };

  return c.json(result);
});

// GET /channels/:channelId/messages/pinned — list pinned messages
app.get("/pinned", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const rows = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      senderId: messages.senderId,
      senderName: sql<string>`COALESCE(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      mentions: messages.mentions,
      parentId: messages.parentId,
      isPinned: messages.isPinned,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      editedAt: messages.editedAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(eq(messages.channelId, channelId), eq(messages.isPinned, 1)))
    .orderBy(desc(messages.pinnedAt))
    .all();

  const result: MessageResponse[] = rows.map((row) => ({
    id: row.id,
    channel_id: row.channelId,
    sender_id: row.senderId,
    sender_name: row.senderName,
    sender_type: row.senderType as "human" | "agent",
    content: row.content,
    mentions: row.mentions ? JSON.parse(row.mentions) : null,
    parent_id: row.parentId,
    is_pinned: true,
    pinned_at: row.pinnedAt,
    pinned_by: row.pinnedBy,
    edited_at: row.editedAt,
    created_at: row.createdAt,
  }));

  return c.json(result);
});

// POST /channels/:channelId/messages
app.post("/", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const body = await safeJsonBody(c);
  if (body === null) return c.json({ detail: "Invalid JSON body" }, 400);
  const parsed = MessageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }
  const db = getDb();

  // Verify channel belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Get human user as sender from auth context
  const human = auth.userId
    ? db.select().from(users).where(eq(users.id, auth.userId)).get()
    : null;
  if (!human) {
    return c.json({ detail: "No user onboarded" }, 400);
  }

  // Enforce slow mode
  const slowModeSeconds = (channel as Record<string, unknown>).slowModeSeconds as number ?? 0;
  if (slowModeSeconds > 0 && human) {
    const lastMsg = db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.channelId, channelId), eq(messages.senderId, human.id)))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get();

    if (lastMsg) {
      const elapsed = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 1000;
      if (elapsed < slowModeSeconds) {
        const waitSeconds = Math.ceil(slowModeSeconds - elapsed);
        return c.json({
          detail: `Slow mode active. Wait ${waitSeconds}s before posting again.`,
          retry_after_seconds: waitSeconds,
        }, 429);
      }
    }
  }

  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const mentionsJson = parsed.data.mentions
    ? JSON.stringify(parsed.data.mentions)
    : null;
  const parentId = parsed.data.parent_id ?? null;
  const { sessionId, startedNew } = resolveChannelSessionForWrite({
    channelId,
    senderId: human.id,
    content: parsed.data.content,
    createdAt: now,
    parentId,
  });

  db.insert(messages)
    .values({
      id: msgId,
      channelId,
      channelSessionId: sessionId,
      senderId: human.id,
      content: parsed.data.content,
      mentions: mentionsJson,
      parentId,
      createdAt: now,
    })
    .run();

  if (startedNew) {
    attachRootMessageToSession(sessionId, msgId);
  }

  const senderName = human.displayName ?? human.name;

  // Broadcast to WebSocket clients (scoped to channel's workspace)
  broadcastEvent(
    newMessageEvent({
      messageId: msgId,
      channelId,
      channelSessionId: sessionId,
      senderId: human.id,
      senderName,
      content: parsed.data.content,
      mentions: parsed.data.mentions,
      parentId,
      createdAt: now,
      senderType: "human",
    }),
    channel.workspaceId
  );

  // Build reply context for agent invocations
  let invokeContent = parsed.data.content;
  if (parentId) {
    const parentMsg = db
      .select({
        content: messages.content,
        senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.id, parentId))
      .get();
    if (parentMsg) {
      invokeContent = `[Replying to ${parentMsg.senderName}: "${parentMsg.content.slice(0, 200)}"]\n\n${parsed.data.content}`;
    }
  }

  // Fire-and-forget: invoke agents in background (DM target or @mentions)
  invokeForMessage(senderName, channelId, channel.name, invokeContent, parsed.data.mentions ?? null, 0, sessionId);

  const response: MessageResponse = {
    id: msgId,
    channel_id: channelId,
    channel_session_id: sessionId,
    sender_id: human.id,
    sender_name: senderName,
    sender_type: "human",
    content: parsed.data.content,
    mentions: parsed.data.mentions ?? null,
    parent_id: parentId,
    is_pinned: false,
    created_at: now,
  };

  return c.json(response, 201);
});

// POST /channels/:channelId/messages/:messageId/pin — toggle pin
app.post("/:messageId/pin", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const db = getDb();

  // Verify channel belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg) return c.json({ detail: "Message not found" }, 404);
  if (msg.channelId !== channelId) return c.json({ detail: "Message does not belong to this channel" }, 400);

  const now = new Date().toISOString();
  const newPinned = msg.isPinned ? 0 : 1;

  db.update(messages)
    .set({
      isPinned: newPinned,
      pinnedAt: newPinned ? now : null,
      pinnedBy: newPinned ? "human" : null,
    })
    .where(eq(messages.id, messageId))
    .run();

  return c.json({
    id: messageId,
    is_pinned: Boolean(newPinned),
    pinned_at: newPinned ? now : null,
  });
});

// GET /channels/:channelId/messages/reactions/summary — emoji usage stats for a channel
app.get("/reactions/summary", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const rows = db
    .select({
      emoji: messageReactions.emoji,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(messageReactions)
    .innerJoin(messages, eq(messageReactions.messageId, messages.id))
    .where(eq(messages.channelId, channelId))
    .groupBy(messageReactions.emoji)
    .orderBy(sql`count(*) DESC`)
    .limit(20)
    .all();

  return c.json({
    channel_id: channelId,
    emojis: rows.map((r) => ({ emoji: r.emoji, count: r.count })),
    total: rows.reduce((sum, r) => sum + r.count, 0),
  });
});

// GET /channels/:channelId/messages/pinned — get pinned messages
app.get("/pinned", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  // Verify channel belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const db = getDb();
  const rows = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      mentions: messages.mentions,
      parentId: messages.parentId,
      isPinned: messages.isPinned,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(eq(messages.channelId, channelId), eq(messages.isPinned, 1)))
    .orderBy(desc(messages.pinnedAt))
    .all();

  return c.json(rows.map((row) => ({
    id: row.id,
    channel_id: row.channelId,
    sender_id: row.senderId,
    sender_name: row.senderName,
    sender_type: row.senderType,
    content: row.content,
    mentions: row.mentions ? JSON.parse(row.mentions) : null,
    parent_id: row.parentId,
    is_pinned: true,
    pinned_at: row.pinnedAt,
    pinned_by: row.pinnedBy,
    created_at: row.createdAt,
  })));
});

// PATCH /channels/:channelId/messages/:messageId — edit message content
app.patch("/:messageId", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const body = await safeJsonBody(c);
  if (body === null) return c.json({ detail: "Invalid JSON body" }, 400);
  const parsed = MessageEditSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }
  const db = getDb();

  // Verify channel belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg) return c.json({ detail: "Message not found" }, 404);
  if (msg.channelId !== channelId) return c.json({ detail: "Message does not belong to this channel" }, 400);

  // Ownership check: only the sender can edit their message
  if (auth.userId && msg.senderId !== auth.userId) {
    return c.json({ detail: "You can only edit your own messages" }, 403);
  }

  const editedAt = new Date().toISOString();
  db.update(messages)
    .set({ content: parsed.data.content, editedAt })
    .where(eq(messages.id, messageId))
    .run();

  broadcastEvent(messageEditedEvent({ messageId, channelId, content: parsed.data.content, editedAt }), channel.workspaceId);

  return c.json({ id: messageId, content: parsed.data.content, edited_at: editedAt });
});

// DELETE /channels/:channelId/messages/:messageId
app.delete("/:messageId", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const db = getDb();

  // Verify channel exists and belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Verify message exists and belongs to this channel
  const msg = db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .get();
  if (!msg) {
    return c.json({ detail: "Message not found" }, 404);
  }
  if (msg.channelId !== channelId) {
    return c.json({ detail: "Message does not belong to this channel" }, 400);
  }

  // Ownership check: only the sender can delete their message
  if (auth.userId && msg.senderId !== auth.userId) {
    return c.json({ detail: "You can only delete your own messages" }, 403);
  }

  // Delete the message
  db.delete(messages).where(eq(messages.id, messageId)).run();
  cleanupChannelSessionAfterMessageDelete(msg.channelSessionId, messageId);

  // Broadcast deletion to WebSocket clients (scoped to channel's workspace)
  broadcastEvent(messageDeletedEvent({ messageId, channelId }), channel.workspaceId);

  return c.json({ deleted: true, id: messageId });
});

// GET /channels/:channelId/messages/:messageId/thread — get thread summary and replies
app.get("/:messageId/thread", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const db = getDb();

  // Verify channel
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  // Get parent message
  const parent = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!parent) return c.json({ detail: "Message not found" }, 404);
  if (parent.channelId !== channelId) return c.json({ detail: "Message does not belong to this channel" }, 400);

  // Get replies
  const replies = db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.parentId, messageId))
    .orderBy(messages.createdAt)
    .all();

  // Unique participants
  const participantMap = new Map<string, string>();
  for (const r of replies) {
    participantMap.set(r.senderId, r.senderName);
  }

  return c.json({
    parent_id: messageId,
    reply_count: replies.length,
    participants: Array.from(participantMap.entries()).map(([id, name]) => ({
      user_id: id,
      name,
    })),
    last_reply_at: replies.length > 0 ? replies[replies.length - 1].createdAt : null,
    replies: replies.map((r) => ({
      id: r.id,
      sender_id: r.senderId,
      sender_name: r.senderName,
      sender_type: r.senderType,
      content: r.content,
      created_at: r.createdAt,
    })),
  });
});

// POST /channels/:channelId/messages/:messageId/react — toggle reaction
app.post("/:messageId/react", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const body = await safeJsonBody(c);
  if (body === null) return c.json({ detail: "Invalid JSON body" }, 400);
  const parsed = ReactionToggleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }
  const db = getDb();

  // Verify channel belongs to current workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  // Verify message exists and belongs to channel
  const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg) return c.json({ detail: "Message not found" }, 404);
  if (msg.channelId !== channelId) return c.json({ detail: "Message does not belong to this channel" }, 400);

  // Get the authenticated user (use auth.userId instead of type-based lookup)
  const human = auth.userId
    ? db.select().from(users).where(eq(users.id, auth.userId)).get()
    : db.select().from(users).where(eq(users.type, "human")).get();
  if (!human) return c.json({ detail: "No user onboarded" }, 400);

  const userName = human.displayName ?? human.name;
  const emoji = parsed.data.emoji;

  // Check if reaction already exists — toggle
  const existing = db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, human.id),
        eq(messageReactions.emoji, emoji),
      )
    )
    .get();

  if (existing) {
    // Remove reaction
    db.delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, human.id),
          eq(messageReactions.emoji, emoji),
        )
      )
      .run();

    broadcastEvent(reactionEvent({ messageId, channelId, emoji, userName, action: "remove" }), channel.workspaceId);
    return c.json({ action: "removed", emoji });
  } else {
    // Add reaction
    const now = new Date().toISOString();
    db.insert(messageReactions)
      .values({ messageId, userId: human.id, emoji, createdAt: now })
      .run();

    broadcastEvent(reactionEvent({ messageId, channelId, emoji, userName, action: "add" }), channel.workspaceId);
    return c.json({ action: "added", emoji });
  }
});

// GET /channels/:channelId/messages/:messageId/reactions — get reactions for a message
app.get("/:messageId/reactions", (c) => {
  const messageId = c.req.param("messageId");
  const db = getDb();

  const rows = db
    .select({
      emoji: messageReactions.emoji,
      userName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
    })
    .from(messageReactions)
    .innerJoin(users, eq(messageReactions.userId, users.id))
    .where(eq(messageReactions.messageId, messageId))
    .all();

  // Group by emoji
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.emoji) ?? [];
    list.push(row.userName);
    grouped.set(row.emoji, list);
  }

  const result = Array.from(grouped.entries()).map(([emoji, userNames]) => ({
    message_id: messageId,
    emoji,
    users: userNames,
    count: userNames.length,
  }));

  return c.json(result);
});

// POST /channels/:channelId/messages/:messageId/forward — forward message to another channel
app.post("/:messageId/forward", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const body = await safeJsonBody(c);
  if (body === null) return c.json({ detail: "Invalid JSON body" }, 400);

  const parsed = z.object({ target_channel_id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ detail: parsed.error.message }, 400);

  const db = getDb();

  // Verify source channel
  const sourceChannel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!sourceChannel) return c.json({ detail: "Source channel not found" }, 404);

  // Verify target channel
  const targetChannel = getChannelInWorkspace(parsed.data.target_channel_id, auth.workspaceId);
  if (!targetChannel) return c.json({ detail: "Target channel not found" }, 404);

  // Verify message exists in source channel
  const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg) return c.json({ detail: "Message not found" }, 404);
  if (msg.channelId !== channelId) return c.json({ detail: "Message does not belong to this channel" }, 400);

  // Cannot forward to same channel
  if (channelId === parsed.data.target_channel_id) {
    return c.json({ detail: "Cannot forward to the same channel" }, 400);
  }

  // Get original sender name
  const sender = db.select().from(users).where(eq(users.id, msg.senderId)).get();
  const senderName = sender?.displayName ?? sender?.name ?? "Unknown";

  // Get forwarding user
  const forwarder = auth.userId
    ? db.select().from(users).where(eq(users.id, auth.userId)).get()
    : null;
  if (!forwarder) return c.json({ detail: "No user onboarded" }, 400);

  // Create forwarded message with attribution
  const forwardedContent = `📨 *Forwarded from ${sourceChannel.name}*\n> **${senderName}**: ${msg.content}`;
  const newMsgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { sessionId, startedNew } = resolveChannelSessionForWrite({
    channelId: parsed.data.target_channel_id,
    senderId: forwarder.id,
    content: forwardedContent,
    createdAt: now,
  });

  db.insert(messages)
    .values({
      id: newMsgId,
      channelId: parsed.data.target_channel_id,
      channelSessionId: sessionId,
      senderId: forwarder.id,
      content: forwardedContent,
      createdAt: now,
    })
    .run();

  if (startedNew) {
    attachRootMessageToSession(sessionId, newMsgId);
  }

  // Broadcast
  broadcastEvent(
    newMessageEvent({
      messageId: newMsgId,
      channelId: parsed.data.target_channel_id,
      channelSessionId: sessionId,
      senderId: forwarder.id,
      senderName: forwarder.displayName ?? forwarder.name,
      content: forwardedContent,
      createdAt: now,
      senderType: "human",
    }),
    auth.workspaceId
  );

  return c.json({
    id: newMsgId,
    channel_session_id: sessionId,
    original_message_id: messageId,
    source_channel_id: channelId,
    target_channel_id: parsed.data.target_channel_id,
    content: forwardedContent,
    created_at: now,
  }, 201);
});

// GET /channels/:channelId/messages/export — export channel messages as JSON
app.get("/export", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const format = c.req.query("format") ?? "json"; // "json" | "csv"
  const limit = Math.min(parseInt(c.req.query("limit") ?? "1000", 10) || 1000, 5000);

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  const rows = db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      senderName: sql`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      parentId: messages.parentId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.channelId, channelId))
    .orderBy(messages.createdAt)
    .limit(limit)
    .all();

  if (format === "csv") {
    const header = "id,sender_name,sender_type,content,created_at";
    const csvRows = rows.map((r: any) => {
      const escapedContent = `"${String(r.content).replace(/"/g, '""')}"`;
      return `${r.id},${r.senderName},${r.senderType},${escapedContent},${r.createdAt}`;
    });
    const csv = [header, ...csvRows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${channel.name.replace("#", "")}-export.csv"`,
      },
    });
  }

  // Default JSON format
  const exportData = {
    channel: { id: channel.id, name: channel.name },
    exported_at: new Date().toISOString(),
    message_count: rows.length,
    messages: rows.map((r: any) => ({
      id: r.id,
      sender_name: r.senderName,
      sender_type: r.senderType,
      content: r.content,
      parent_id: r.parentId,
      created_at: r.createdAt,
    })),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${channel.name.replace("#", "")}-export.json"`,
    },
  });
});

export default app;
