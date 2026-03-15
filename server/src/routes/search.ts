/**
 * Global message search endpoint — GET /search/messages
 */

import { Hono } from "hono";
import { eq, sql, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { messages, users, channels } from "../db/schema";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

// GET /search/messages?q=term&channel_id=optional&sender_id=optional&limit=20
app.get("/messages", (c) => {
  const auth = c.get("auth");
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ detail: "Query parameter 'q' is required" }, 400);
  }

  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10) || 20, 50);
  const channelId = c.req.query("channel_id");
  const senderId = c.req.query("sender_id");
  const db = getDb();

  // Build conditions
  const conditions = [
    sql`${messages.content} LIKE ${"%" + q.trim() + "%"}`,
    sql`${channels.workspaceId} = ${auth.workspaceId}`,
  ];

  if (channelId) {
    conditions.push(eq(messages.channelId, channelId));
  }
  if (senderId) {
    conditions.push(eq(messages.senderId, senderId));
  }

  const rows = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      channelName: channels.name,
      senderId: messages.senderId,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      parentId: messages.parentId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .innerJoin(channels, eq(messages.channelId, channels.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  const results = rows.map((row) => ({
    id: row.id,
    channel_id: row.channelId,
    channel_name: row.channelName,
    sender_id: row.senderId,
    sender_name: row.senderName,
    sender_type: row.senderType,
    content: row.content,
    parent_id: row.parentId,
    created_at: row.createdAt,
  }));

  return c.json({ query: q.trim(), count: results.length, results });
});

export default app;
