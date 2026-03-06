/**
 * Workspace broadcast — send a message to all non-archived channels at once.
 *
 * POST /api/broadcast — post the same message to every active channel in the workspace.
 * Useful for announcements, system notices, or workspace-wide alerts.
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { channels, messages, users } from "../db/schema";
import { broadcastEvent, newMessageEvent } from "../services/broadcaster";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

export const BroadcastSchema = z.object({
  content: z.string().min(1).max(32000),
  channel_types: z.array(z.string()).optional(), // filter to specific types, e.g. ["general", "custom"]
});
export type Broadcast = z.infer<typeof BroadcastSchema>;

// POST /api/broadcast
app.post("/", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ detail: "Invalid JSON body" }, 400);

  const parsed = BroadcastSchema.safeParse(body);
  if (!parsed.success) return c.json({ detail: parsed.error.message }, 400);

  const db = getDb();

  // Resolve sender
  const senderId = auth.userId;
  if (!senderId) return c.json({ detail: "No authenticated user" }, 401);

  const sender = db.select().from(users).where(eq(users.id, senderId)).get();
  if (!sender) return c.json({ detail: "User not found" }, 404);

  const senderName = sender.displayName ?? sender.name;

  // Get all active channels in workspace
  let allChannels = db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, auth.workspaceId))
    .all()
    .filter((ch) => ch.isArchived !== 1);

  // Filter by channel type if specified
  if (parsed.data.channel_types && parsed.data.channel_types.length > 0) {
    const types = new Set(parsed.data.channel_types);
    allChannels = allChannels.filter((ch) => types.has(ch.type));
  }

  if (allChannels.length === 0) {
    return c.json({ detail: "No matching channels found" }, 404);
  }

  const now = new Date().toISOString();
  const results: { channel_id: string; channel_name: string; message_id: string }[] = [];

  for (const channel of allChannels) {
    const messageId = crypto.randomUUID();
    db.insert(messages)
      .values({
        id: messageId,
        channelId: channel.id,
        senderId,
        content: parsed.data.content,
        createdAt: now,
      })
      .run();

    broadcastEvent(
      newMessageEvent({
        messageId,
        channelId: channel.id,
        senderId,
        senderName,
        senderType: sender.type,
        content: parsed.data.content,
        createdAt: now,
      }),
      auth.workspaceId
    );

    results.push({
      channel_id: channel.id,
      channel_name: channel.name,
      message_id: messageId,
    });
  }

  return c.json({
    broadcast_count: results.length,
    channels: results,
  }, 201);
});

export default app;
