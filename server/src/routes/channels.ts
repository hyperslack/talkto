/**
 * Channel CRUD endpoints.
 */

import { Hono } from "hono";
import { eq, asc, and, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { channels, channelMembers, users, agents, messages, readReceipts } from "../db/schema";
import { ChannelCreateSchema, ChannelTopicSchema } from "../types";
import type { AppBindings, ChannelResponse } from "../types";
import { requireAdmin } from "../middleware/auth";
import { deleteChannelGraph } from "../services/admin-manager";

const app = new Hono<AppBindings>();

/** Look up a channel by ID scoped to a workspace. Returns null if not found or wrong workspace. */
function getChannelInWorkspace(channelId: string, workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, workspaceId)))
    .get() ?? null;
}

function channelToResponse(ch: typeof channels.$inferSelect, extras?: { pinned_count?: number }): ChannelResponse {
  return {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    topic: ch.topic,
    position: ch.position ?? 0,
    project_path: ch.projectPath,
    created_by: ch.createdBy,
    created_at: ch.createdAt,
    is_archived: ch.isArchived === 1,
    archived_at: ch.archivedAt,
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
    result = result.filter((ch) => ch.isArchived !== 1);
  }

  // Batch-fetch pinned counts for all channels
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

  return c.json(result.map((ch) => channelToResponse(ch, { pinned_count: pinnedCounts.get(ch.id) ?? 0 })));
});

// GET /channels/unread/counts — get unread counts for all channels for a user
// NOTE: Must be before /:channelId to avoid route conflict
app.get("/unread/counts", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const userId = c.req.query("user_id");

  // Use auth.userId, fall back to query param, then to type-based lookup
  let resolvedUserId = auth.userId ?? userId;
  if (!resolvedUserId) {
    const human = db.select().from(users).where(eq(users.type, "human")).get();
    if (!human) return c.json({ detail: "No user found" }, 400);
    resolvedUserId = human.id;
  }

  // Get channels scoped to workspace
  const allChannels = db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .all();

  // Get all read receipts for this user
  const receipts = db
    .select()
    .from(readReceipts)
    .where(eq(readReceipts.userId, resolvedUserId))
    .all();
  const receiptMap = new Map(receipts.map((r) => [r.channelId, r.lastReadAt]));

  const results = allChannels.map((ch) => {
    const lastReadAt = receiptMap.get(ch.id);

    // Count messages after last_read_at (or all messages if never read)
    let unreadCount: number;
    if (lastReadAt) {
      const row = db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(eq(messages.channelId, ch.id), gt(messages.createdAt, lastReadAt)))
        .get();
      unreadCount = row?.count ?? 0;
    } else {
      const row = db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.channelId, ch.id))
        .get();
      unreadCount = row?.count ?? 0;
    }

    return {
      channel_id: ch.id,
      channel_name: ch.name,
      unread_count: unreadCount,
      last_read_at: lastReadAt ?? null,
    };
  });

  return c.json(results);
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

  // Check uniqueness within workspace
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

// PATCH /channels/:channelId/topic — set channel topic
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

// PATCH /channels/:channelId/position — set channel position
app.patch("/:channelId/position", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const position = body?.position;
  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return c.json({ detail: "position must be a non-negative integer" }, 400);
  }

  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const db = getDb();
  db.update(channels)
    .set({ position })
    .where(eq(channels.id, channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, channel.id)).get()!;
  return c.json(channelToResponse(updated));
});

// PUT /channels/reorder — bulk reorder channels
app.put("/reorder", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const order = body?.order;
  if (!Array.isArray(order) || !order.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    typeof (item as Record<string, unknown>).channel_id === "string" &&
    typeof (item as Record<string, unknown>).position === "number"
  )) {
    return c.json({ detail: "order must be array of { channel_id, position }" }, 400);
  }

  const db = getDb();
  for (const item of order) {
    const ch = getChannelInWorkspace(item.channel_id, auth.workspaceId);
    if (ch) {
      db.update(channels)
        .set({ position: item.position })
        .where(eq(channels.id, item.channel_id))
        .run();
    }
  }

  return c.json({ updated: order.length });
});

// GET /channels/:channelId
app.get("/:channelId", (c) => {
  const auth = c.get("auth");
  const channel = getChannelInWorkspace(c.req.param("channelId"), auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Resolve creator name
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
    createdByName = channel.createdBy; // "system" or "human"
  }

  const response = channelToResponse(channel);
  response.created_by_name = createdByName;
  return c.json(response);
});

// GET /channels/:channelId/members — list all members in a channel
app.get("/:channelId/members", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  // Verify channel exists and belongs to workspace
  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Fetch members with user info and optional agent info
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

  const result = members.map((m) => ({
    user_id: m.userId,
    name: m.displayName ?? m.name,
    type: m.type,
    joined_at: m.joinedAt,
    agent_name: m.agentName ?? null,
    agent_type: m.agentType ?? null,
    status: m.status ?? null,
  }));

  return c.json(result);
});

// GET /channels/:channelId/stats — get channel statistics
app.get("/:channelId/stats", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  const db = getDb();

  // Message count
  const msgCount = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .get();

  // Member count
  const memberCount = db
    .select({ count: sql<number>`count(*)` })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId))
    .get();

  // Pinned message count
  const pinnedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), eq(messages.isPinned, 1)))
    .get();

  // Last message timestamp
  const lastMsg = db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(sql`${messages.createdAt} DESC`)
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

// POST /channels/:channelId/archive — archive a channel
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

// POST /channels/:channelId/unarchive — unarchive a channel
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

// DELETE /channels/:channelId — permanently delete a channel and its message graph
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

// POST /channels/:channelId/read — mark channel as read for a user
app.post("/:channelId/read", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const db = getDb();

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  // Use auth.userId, fall back to body, then type-based lookup
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
    if (!human) return c.json({ detail: "No user found" }, 400);
    userId = human.id;
  }

  const now = new Date().toISOString();

  // Upsert read receipt
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
