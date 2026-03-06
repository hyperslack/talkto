/**
 * Scheduled messages — create, list, cancel messages scheduled for future delivery.
 *
 * POST   /api/channels/:channelId/messages/schedule  — schedule a message
 * GET    /api/channels/:channelId/messages/scheduled  — list pending scheduled messages
 * DELETE /api/channels/:channelId/messages/schedule/:scheduleId — cancel a scheduled message
 *
 * A background interval checks every 10s and delivers due messages.
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { channels, messages, users } from "../db/schema";
import { broadcastEvent, newMessageEvent } from "../services/broadcaster";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

export const ScheduleMessageSchema = z.object({
  content: z.string().min(1).max(32000),
  send_at: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "send_at must be a valid ISO 8601 timestamp",
  }),
  mentions: z.array(z.string()).max(50).optional(),
});
export type ScheduleMessage = z.infer<typeof ScheduleMessageSchema>;

/**
 * In-memory store for scheduled messages.
 * In production this would be a DB table, but for simplicity we use memory
 * with a background delivery loop.
 */
export interface ScheduledMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  mentions?: string[];
  sendAt: string; // ISO timestamp
  workspaceId: string;
  createdAt: string;
  status: "pending" | "sent" | "cancelled";
}

// Exported for testing
export const scheduledMessages: ScheduledMessage[] = [];

/** Deliver all due scheduled messages */
export function deliverDueMessages(): number {
  const now = new Date().toISOString();
  let delivered = 0;

  for (const msg of scheduledMessages) {
    if (msg.status !== "pending") continue;
    if (msg.sendAt > now) continue;

    const db = getDb();
    const messageId = crypto.randomUUID();

    db.insert(messages)
      .values({
        id: messageId,
        channelId: msg.channelId,
        senderId: msg.senderId,
        content: msg.content,
        mentions: msg.mentions ? JSON.stringify(msg.mentions) : null,
        createdAt: now,
      })
      .run();

    broadcastEvent(
      newMessageEvent({
        messageId,
        channelId: msg.channelId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        mentions: msg.mentions,
        createdAt: now,
      }),
      msg.workspaceId
    );

    msg.status = "sent";
    delivered++;
  }

  return delivered;
}

// Background delivery loop — every 10 seconds
let deliveryInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduleDelivery(): void {
  if (!deliveryInterval) {
    deliveryInterval = setInterval(deliverDueMessages, 10_000);
  }
}

export function stopScheduleDelivery(): void {
  if (deliveryInterval) {
    clearInterval(deliveryInterval);
    deliveryInterval = null;
  }
}

// POST /api/channels/:channelId/messages/schedule
app.post("/", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ detail: "Invalid JSON body" }, 400);

  const parsed = ScheduleMessageSchema.safeParse(body);
  if (!parsed.success) return c.json({ detail: parsed.error.message }, 400);

  const db = getDb();
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, auth.workspaceId)))
    .get();

  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  // send_at must be in the future
  const sendAt = new Date(parsed.data.send_at);
  if (sendAt <= new Date()) {
    return c.json({ detail: "send_at must be in the future" }, 400);
  }

  // Resolve sender
  const senderId = auth.userId ?? "unknown";
  const sender = db.select().from(users).where(eq(users.id, senderId)).get();
  const senderName = sender?.displayName ?? sender?.name ?? "Unknown";

  const scheduled: ScheduledMessage = {
    id: crypto.randomUUID(),
    channelId,
    senderId,
    senderName,
    content: parsed.data.content,
    mentions: parsed.data.mentions,
    sendAt: sendAt.toISOString(),
    workspaceId: auth.workspaceId,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  scheduledMessages.push(scheduled);

  return c.json({
    id: scheduled.id,
    channel_id: channelId,
    content: scheduled.content,
    send_at: scheduled.sendAt,
    status: scheduled.status,
    created_at: scheduled.createdAt,
  }, 201);
});

// GET /api/channels/:channelId/messages/scheduled — list pending
app.get("/", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  const pending = scheduledMessages.filter(
    (m) => m.channelId === channelId && m.workspaceId === auth.workspaceId && m.status === "pending"
  );

  return c.json(pending.map((m) => ({
    id: m.id,
    channel_id: m.channelId,
    content: m.content,
    send_at: m.sendAt,
    status: m.status,
    created_at: m.createdAt,
  })));
});

// DELETE /:scheduleId — cancel
app.delete("/:scheduleId", (c) => {
  const auth = c.get("auth");
  const scheduleId = c.req.param("scheduleId");

  const msg = scheduledMessages.find(
    (m) => m.id === scheduleId && m.workspaceId === auth.workspaceId
  );

  if (!msg) return c.json({ detail: "Scheduled message not found" }, 404);
  if (msg.status !== "pending") {
    return c.json({ detail: `Cannot cancel message with status: ${msg.status}` }, 400);
  }

  msg.status = "cancelled";
  return c.json({ id: msg.id, status: "cancelled" });
});

export default app;
