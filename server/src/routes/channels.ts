/**
 * Channel CRUD endpoints.
 */

import { Hono } from "hono";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  agents,
  channelMembers,
  channels,
  messages,
  readReceipts,
  users,
  workspaceMembers,
} from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import { deleteChannelGraph } from "../services/admin-manager";
import {
  ChannelCategorySchema,
  ChannelCreateSchema,
  ChannelRenameSchema,
  ChannelSlowModeSchema,
  ChannelTopicSchema,
} from "../types";
import type { AppBindings, ChannelResponse } from "../types";

const app = new Hono<AppBindings>();

/** Look up a channel by ID scoped to a workspace. */
function getChannelInWorkspace(channelId: string, workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, workspaceId)))
    .get() ?? null;
}

function channelToResponse(
  channel: typeof channels.$inferSelect,
  extras?: { pinned_count?: number }
): ChannelResponse {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    position: channel.position ?? 0,
    category: channel.category ?? null,
    slow_mode_seconds: channel.slowModeSeconds ?? 0,
    project_path: channel.projectPath,
    created_by: channel.createdBy,
    created_at: channel.createdAt,
    is_read_only: channel.isReadOnly === 1,
    is_archived: channel.isArchived === 1,
    archived_at: channel.archivedAt,
    pinned_count: extras?.pinned_count,
  };
}

// GET /channels
app.get("/", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const includeArchived = c.req.query("include_archived") === "true";

  let result = db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .orderBy(asc(channels.position), asc(channels.name))
    .all();

  if (!includeArchived) {
    result = result.filter((channel) => channel.isArchived !== 1);
  }

  const pinnedCounts = new Map<string, number>();
  if (result.length > 0) {
    const rows = db
      .select({
        channelId: messages.channelId,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(eq(messages.isPinned, 1))
      .groupBy(messages.channelId)
      .all();

    for (const row of rows) {
      pinnedCounts.set(row.channelId, row.count);
    }
  }

  const lastActiveRows = db
    .select({
      channelId: messages.channelId,
      lastActiveAt: sql<string>`MAX(${messages.createdAt})`.as("last_active_at"),
    })
    .from(messages)
    .groupBy(messages.channelId)
    .all();
  const lastActiveMap = new Map(lastActiveRows.map((row) => [row.channelId, row.lastActiveAt]));

  const memberCountRows = db
    .select({
      channelId: channelMembers.channelId,
      memberCount: sql<number>`count(*)`.as("member_count"),
    })
    .from(channelMembers)
    .groupBy(channelMembers.channelId)
    .all();
  const memberCountMap = new Map(memberCountRows.map((row) => [row.channelId, row.memberCount]));

  const messageCountRows = db
    .select({
      channelId: messages.channelId,
      messageCount: sql<number>`count(*)`.as("message_count"),
    })
    .from(messages)
    .groupBy(messages.channelId)
    .all();
  const messageCountMap = new Map(messageCountRows.map((row) => [row.channelId, row.messageCount]));

  return c.json(
    result.map((channel) => ({
      ...channelToResponse(channel, { pinned_count: pinnedCounts.get(channel.id) ?? 0 }),
      last_active_at: lastActiveMap.get(channel.id) ?? null,
      member_count: memberCountMap.get(channel.id) ?? 0,
      message_count: messageCountMap.get(channel.id) ?? 0,
    }))
  );
});

// GET /channels/unread/counts
// NOTE: Must stay before /:channelId to avoid route conflicts.
app.get("/unread/counts", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const userId = c.req.query("user_id");

  let resolvedUserId = auth.userId ?? userId;
  if (!resolvedUserId) {
    const human = db.select().from(users).where(eq(users.type, "human")).get();
    if (!human) {
      return c.json({ detail: "No user found" }, 400);
    }
    resolvedUserId = human.id;
  }

  const allChannels = db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .all();

  const receipts = db
    .select()
    .from(readReceipts)
    .where(eq(readReceipts.userId, resolvedUserId))
    .all();
  const receiptMap = new Map(receipts.map((receipt) => [receipt.channelId, receipt.lastReadAt]));

  return c.json(
    allChannels.map((channel) => {
      const lastReadAt = receiptMap.get(channel.id);
      let unreadCount = 0;

      if (lastReadAt) {
        const row = db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(eq(messages.channelId, channel.id), gt(messages.createdAt, lastReadAt)))
          .get();
        unreadCount = row?.count ?? 0;
      } else {
        const row = db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.channelId, channel.id))
          .get();
        unreadCount = row?.count ?? 0;
      }

      return {
        channel_id: channel.id,
        channel_name: channel.name,
        unread_count: unreadCount,
        last_read_at: lastReadAt ?? null,
      };
    })
  );
});

// POST /channels
app.post("/", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = ChannelCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const name = parsed.data.name.startsWith("#")
    ? parsed.data.name
    : `#${parsed.data.name}`;
  const db = getDb();

  const existing = db
    .select()
    .from(channels)
    .where(and(eq(channels.name, name), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (existing) {
    return c.json({ detail: `Channel ${name} already exists` }, 409);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(channels)
    .values({
      id,
      name,
      type: "custom",
      createdBy: auth.userId ?? "human",
      createdAt: now,
      workspaceId: auth.workspaceId,
    })
    .run();

  const channel = db.select().from(channels).where(eq(channels.id, id)).get()!;
  return c.json(channelToResponse(channel), 201);
});

// PATCH /channels/:channelId/name
app.patch("/:channelId/name", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = ChannelRenameSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }
  if (channel.type === "general") {
    return c.json({ detail: "Cannot rename the #general channel" }, 400);
  }

  const newName = parsed.data.name.startsWith("#")
    ? parsed.data.name
    : `#${parsed.data.name}`;

  const db = getDb();
  const existing = db
    .select()
    .from(channels)
    .where(and(eq(channels.name, newName), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (existing && existing.id !== channel.id) {
    return c.json({ detail: `Channel ${newName} already exists` }, 409);
  }

  db.update(channels)
    .set({ name: newName })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PATCH /channels/:channelId/topic
app.patch("/:channelId/topic", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = ChannelTopicSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  db.update(channels)
    .set({ topic: parsed.data.topic || null })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PATCH /channels/:channelId/position
app.patch("/:channelId/position", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const position = body?.position;
  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return c.json({ detail: "position must be a non-negative integer" }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  db.update(channels)
    .set({ position })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PATCH /channels/:channelId/read-only
app.patch("/:channelId/read-only", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const readOnly = body?.read_only;
  if (typeof readOnly !== "boolean") {
    return c.json({ detail: "read_only must be a boolean" }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  db.update(channels)
    .set({ isReadOnly: readOnly ? 1 : 0 })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PATCH /channels/:channelId/category
app.patch("/:channelId/category", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = ChannelCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  db.update(channels)
    .set({ category: parsed.data.category || null })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PATCH /channels/:channelId/slow-mode
app.patch("/:channelId/slow-mode", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = ChannelSlowModeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  db.update(channels)
    .set({ slowModeSeconds: parsed.data.seconds })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PUT /channels/reorder
app.put("/reorder", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const order = body?.order;

  if (!Array.isArray(order) || !order.every((item: unknown) =>
    typeof item === "object" &&
    item !== null &&
    typeof (item as Record<string, unknown>).channel_id === "string" &&
    typeof (item as Record<string, unknown>).position === "number"
  )) {
    return c.json({ detail: "order must be array of { channel_id, position }" }, 400);
  }

  const db = getDb();
  for (const item of order) {
    const channel = getChannelInWorkspace(item.channel_id, auth.workspaceId);
    if (!channel) continue;

    db.update(channels)
      .set({ position: item.position })
      .where(eq(channels.id, item.channel_id))
      .run();
  }

  return c.json({ updated: order.length });
});

// GET /channels/categories/list
app.get("/categories/list", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const rows = db
    .select({ category: channels.category })
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .all();

  const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort();
  return c.json({ categories });
});

// GET /channels/:channelId
app.get("/:channelId", (c) => {
  const auth = c.get("auth");
  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  let createdByName: string | null = null;
  if (channel.createdBy && channel.createdBy !== "system" && channel.createdBy !== "human") {
    const db = getDb();
    const creator = db
      .select({ name: users.name, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, channel.createdBy))
      .get();
    createdByName = creator ? (creator.displayName ?? creator.name) : null;
  } else {
    createdByName = channel.createdBy;
  }

  const db = getDb();
  const lastActive = db
    .select({ lastActiveAt: sql<string>`MAX(${messages.createdAt})` })
    .from(messages)
    .where(eq(messages.channelId, channel.id))
    .get();

  return c.json({
    ...channelToResponse(channel),
    created_by_name: createdByName,
    last_active_at: lastActive?.lastActiveAt ?? null,
  });
});

// GET /channels/:channelId/members
app.get("/:channelId/members", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const members = db
    .select({
      userId: channelMembers.userId,
      joinedAt: channelMembers.joinedAt,
      name: users.name,
      displayName: users.displayName,
      type: users.type,
      agentName: agents.agentName,
      agentType: agents.agentType,
      status: agents.status,
    })
    .from(channelMembers)
    .innerJoin(users, eq(channelMembers.userId, users.id))
    .leftJoin(agents, eq(channelMembers.userId, agents.id))
    .where(eq(channelMembers.channelId, channelId))
    .all();

  return c.json(
    members.map((member) => ({
      user_id: member.userId,
      name: member.displayName ?? member.name,
      type: member.type,
      joined_at: member.joinedAt,
      agent_name: member.agentName ?? null,
      agent_type: member.agentType ?? null,
      status: member.status ?? null,
    }))
  );
});

// GET /channels/:channelId/stats
app.get("/:channelId/stats", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  const msgCount = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .get();
  const memberCount = db
    .select({ count: sql<number>`count(*)` })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId))
    .get();
  const pinnedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), eq(messages.isPinned, 1)))
    .get();
  const lastMsg = db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();

  return c.json({
    channel_id: channelId,
    message_count: msgCount?.count ?? 0,
    member_count: memberCount?.count ?? 0,
    pinned_count: pinnedCount?.count ?? 0,
    last_message_at: lastMsg?.createdAt ?? null,
    created_at: channel.createdAt,
  });
});

// GET /channels/:channelId/mentionable
app.get("/:channelId/mentionable", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const members = db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      type: users.type,
      agentName: agents.agentName,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(users.id, workspaceMembers.userId))
    .leftJoin(agents, eq(users.id, agents.id))
    .where(eq(workspaceMembers.workspaceId, auth.workspaceId))
    .all();

  return c.json(
    members.map((member) => ({
      id: member.id,
      name: member.name,
      display_name: member.displayName ?? null,
      type: member.type,
      mention_name: member.agentName ?? member.name,
    }))
  );
});

// GET /channels/:channelId/top-senders
app.get("/:channelId/top-senders", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10", 10) || 10, 50);

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();
  const rows = db
    .select({
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      messageCount: sql<number>`count(*)`,
      lastMessageAt: sql<string>`max(${messages.createdAt})`,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.channelId, channelId))
    .groupBy(messages.senderId, users.displayName, users.name, users.type)
    .orderBy(sql`count(*) DESC`)
    .limit(limit)
    .all();

  return c.json(
    rows.map((row) => ({
      sender_id: row.senderId,
      sender_name: row.senderName,
      sender_type: row.senderType,
      message_count: row.messageCount,
      last_message_at: row.lastMessageAt,
    }))
  );
});

// POST /channels/:channelId/archive
app.post("/:channelId/archive", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }
  if (channel.isArchived === 1) {
    return c.json({ detail: "Channel is already archived" }, 400);
  }
  if (channel.type === "general") {
    return c.json({ detail: "Cannot archive the #general channel" }, 400);
  }

  const now = new Date().toISOString();
  db.update(channels)
    .set({ isArchived: 1, archivedAt: now })
    .where(eq(channels.id, channelId))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channelId)).get()!;
  return c.json(channelToResponse(updated));
});

// POST /channels/:channelId/unarchive
app.post("/:channelId/unarchive", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }
  if (channel.isArchived !== 1) {
    return c.json({ detail: "Channel is not archived" }, 400);
  }

  db.update(channels)
    .set({ isArchived: 0, archivedAt: null })
    .where(eq(channels.id, channelId))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channelId)).get()!;
  return c.json(channelToResponse(updated));
});

// DELETE /channels/:channelId
app.delete("/:channelId", requireAdmin, (c) => {
  const auth = c.get("auth");
  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }
  if (channel.type === "general") {
    return c.json({ detail: "Cannot delete the #general channel" }, 400);
  }

  return c.json(deleteChannelGraph(channel));
});

// POST /channels/read-all — mark all channels as read
app.post("/read-all", async (c) => {
  const auth = c.get("auth");
  const db = getDb();

  let userId = auth.userId ?? "";
  if (!userId) {
    try {
      const body = await c.req.json();
      userId = body.user_id ?? "";
    } catch {
      userId = "";
    }
  }

  if (!userId) {
    const human = db.select().from(users).where(eq(users.type, "human")).get();
    if (!human) {
      return c.json({ detail: "No user found" }, 400);
    }
    userId = human.id;
  }

  const allChannels = db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .all();

  const now = new Date().toISOString();
  let updated = 0;

  for (const channel of allChannels) {
    const existing = db
      .select()
      .from(readReceipts)
      .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, channel.id)))
      .get();

    if (existing) {
      db.update(readReceipts)
        .set({ lastReadAt: now })
        .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, channel.id)))
        .run();
    } else {
      db.insert(readReceipts)
        .values({ userId, channelId: channel.id, lastReadAt: now })
        .run();
    }
    updated++;
  }

  return c.json({ user_id: userId, channels_marked: updated, last_read_at: now });
});

// POST /channels/:channelId/read
app.post("/:channelId/read", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  let userId = auth.userId ?? "";
  if (!userId) {
    try {
      const body = await c.req.json();
      userId = body.user_id ?? "";
    } catch {
      userId = "";
    }
  }

  if (!userId) {
    const human = db.select().from(users).where(eq(users.type, "human")).get();
    if (!human) {
      return c.json({ detail: "No user found" }, 400);
    }
    userId = human.id;
  }

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(readReceipts)
    .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, channelId)))
    .get();

  if (existing) {
    db.update(readReceipts)
      .set({ lastReadAt: now })
      .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, channelId)))
      .run();
  } else {
    db.insert(readReceipts)
      .values({ userId, channelId, lastReadAt: now })
      .run();
  }

  return c.json({ channel_id: channelId, user_id: userId, last_read_at: now });
});

export default app;
