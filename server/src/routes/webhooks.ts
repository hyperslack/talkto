/**
 * Incoming webhook endpoint — allows external services to post messages to channels.
 *
 * POST /api/webhooks/incoming
 * Body: { channel_id: string, sender_name: string, content: string, avatar_url?: string }
 *
 * Messages appear as "webhook" type senders with configurable display names.
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { channels, messages, users } from "../db/schema";
import { broadcastEvent, newMessageEvent } from "../services/broadcaster";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

export const WebhookMessageSchema = z.object({
  channel_id: z.string().uuid(),
  sender_name: z.string().min(1).max(100),
  content: z.string().min(1).max(32000),
  avatar_url: z.string().url().optional(),
});
export type WebhookMessage = z.infer<typeof WebhookMessageSchema>;

/**
 * Get or create a webhook pseudo-user for the given sender name.
 * Webhook users have type "webhook" and are reused by name.
 */
function getOrCreateWebhookUser(senderName: string, avatarUrl?: string): string {
  const db = getDb();
  const normalizedName = `webhook:${senderName}`;

  const existing = db
    .select()
    .from(users)
    .where(eq(users.name, normalizedName))
    .get();

  if (existing) {
    // Update avatar if provided and different
    if (avatarUrl && existing.avatarUrl !== avatarUrl) {
      db.update(users)
        .set({ avatarUrl })
        .where(eq(users.id, existing.id))
        .run();
    }
    return existing.id;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.insert(users)
    .values({
      id,
      name: normalizedName,
      type: "webhook",
      displayName: senderName,
      avatarUrl: avatarUrl ?? null,
      createdAt: now,
    })
    .run();
  return id;
}

// POST /api/webhooks/incoming
app.post("/incoming", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ detail: "Invalid JSON body" }, 400);
  }

  const parsed = WebhookMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const { channel_id, sender_name, content, avatar_url } = parsed.data;
  const db = getDb();

  // Verify channel exists and belongs to workspace
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channel_id), eq(channels.workspaceId, auth.workspaceId)))
    .get();

  if (!channel) {
    return c.json({ detail: "Channel not found" }, 404);
  }

  if (channel.isArchived === 1) {
    return c.json({ detail: "Cannot post to archived channel" }, 400);
  }

  // Get or create webhook user
  const senderId = getOrCreateWebhookUser(sender_name, avatar_url);

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(messages)
    .values({
      id: messageId,
      channelId: channel_id,
      senderId,
      content,
      createdAt: now,
    })
    .run();

  // Broadcast via WebSocket
  broadcastEvent(
    newMessageEvent({
      messageId,
      channelId: channel_id,
      senderId,
      senderName: sender_name,
      senderType: "webhook",
      content,
      createdAt: now,
    }),
    auth.workspaceId
  );

  return c.json({
    id: messageId,
    channel_id,
    sender_name,
    content,
    created_at: now,
  }, 201);
});

export default app;
