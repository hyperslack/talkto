/**
 * Channel history export endpoint — GET /channels/:channelId/export
 */

import { Hono } from "hono";
import { eq, asc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { messages, users, channels } from "../db/schema";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

// GET /channels/:channelId/export?format=json
app.get("/", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const format = c.req.query("format") ?? "json";
  const db = getDb();

  // Verify channel exists in workspace
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const rows = db
    .select({
      id: messages.id,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      senderType: users.type,
      content: messages.content,
      parentId: messages.parentId,
      isPinned: messages.isPinned,
      editedAt: messages.editedAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.channelId, channelId))
    .orderBy(asc(messages.createdAt))
    .all();

  if (format === "text") {
    const lines = rows.map((r) => {
      const ts = r.createdAt.replace("T", " ").replace(/\.\d+Z$/, "");
      const edited = r.editedAt ? " (edited)" : "";
      return `[${ts}] ${r.senderName}: ${r.content}${edited}`;
    });

    return c.text(lines.join("\n"), 200, {
      "Content-Disposition": `attachment; filename="${channel.name.replace("#", "")}-export.txt"`,
    });
  }

  // Default: JSON
  const exportData = {
    channel: {
      id: channel.id,
      name: channel.name,
      topic: channel.topic,
      created_at: channel.createdAt,
    },
    message_count: rows.length,
    exported_at: new Date().toISOString(),
    messages: rows.map((r) => ({
      id: r.id,
      sender_name: r.senderName,
      sender_type: r.senderType,
      content: r.content,
      parent_id: r.parentId,
      is_pinned: Boolean(r.isPinned),
      edited_at: r.editedAt,
      created_at: r.createdAt,
    })),
  };

  return c.json(exportData, 200, {
    "Content-Disposition": `attachment; filename="${channel.name.replace("#", "")}-export.json"`,
  });
});

export default app;
