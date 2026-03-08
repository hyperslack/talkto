/**
 * Channel welcome message — set a welcome message that new members see when joining.
 *
 * GET    /api/channels/:channelId/welcome  — get current welcome message
 * PATCH  /api/channels/:channelId/welcome  — set or clear welcome message
 *
 * Welcome messages are stored in an in-memory map keyed by channel ID.
 * They are displayed to users upon joining a channel.
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { channels } from "../db/schema";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

export const WelcomeMessageSchema = z.object({
  message: z.string().max(2000).optional(),
});
export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;

// In-memory store: channelId → welcome message
export const welcomeMessages = new Map<string, string>();

/** Look up channel scoped to workspace */
function getChannelInWorkspace(channelId: string, workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, workspaceId)))
    .get() ?? null;
}

// GET /api/channels/:channelId/welcome
app.get("/", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const message = welcomeMessages.get(channelId) ?? null;
  return c.json({ channel_id: channelId, welcome_message: message });
});

// PATCH /api/channels/:channelId/welcome
app.patch("/", async (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  const channel = getChannelInWorkspace(channelId, auth.workspaceId);
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ detail: "Invalid JSON body" }, 400);

  const parsed = WelcomeMessageSchema.safeParse(body);
  if (!parsed.success) return c.json({ detail: parsed.error.message }, 400);

  if (parsed.data.message) {
    welcomeMessages.set(channelId, parsed.data.message);
  } else {
    welcomeMessages.delete(channelId);
  }

  return c.json({
    channel_id: channelId,
    welcome_message: welcomeMessages.get(channelId) ?? null,
  });
});

export default app;
