/**
 * Typing indicator endpoints — POST to set typing, GET to query who's typing.
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { users, channels } from "../db/schema";
import type { AppBindings } from "../types";

interface TypingState {
  userId: string;
  userName: string;
  channelId: string;
  startedAt: number; // ms timestamp
}

const typingStates: TypingState[] = [];
const TYPING_TIMEOUT_MS = 10_000; // 10 seconds

function cleanExpired() {
  const now = Date.now();
  for (let i = typingStates.length - 1; i >= 0; i--) {
    if (now - typingStates[i].startedAt > TYPING_TIMEOUT_MS) {
      typingStates.splice(i, 1);
    }
  }
}

const app = new Hono<AppBindings>();

// POST /typing — set typing indicator for current user in a channel
app.post("/", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json().catch(() => null);
  if (!body || !body.channel_id) {
    return c.json({ detail: "channel_id is required" }, 400);
  }

  const db = getDb();
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, body.channel_id), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (!channel) return c.json({ detail: "Channel not found" }, 404);

  const user = auth.userId
    ? db.select().from(users).where(eq(users.id, auth.userId)).get()
    : db.select().from(users).where(eq(users.type, "human")).get();
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  cleanExpired();

  // Update or add typing state
  const existing = typingStates.find(
    (t) => t.userId === user.id && t.channelId === body.channel_id
  );
  if (existing) {
    existing.startedAt = Date.now();
  } else {
    typingStates.push({
      userId: user.id,
      userName: user.displayName ?? user.name,
      channelId: body.channel_id,
      startedAt: Date.now(),
    });
  }

  return c.json({ typing: true });
});

// DELETE /typing — stop typing indicator
app.delete("/", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json().catch(() => null);
  if (!body || !body.channel_id) {
    return c.json({ detail: "channel_id is required" }, 400);
  }

  const db = getDb();
  const user = auth.userId
    ? db.select().from(users).where(eq(users.id, auth.userId)).get()
    : db.select().from(users).where(eq(users.type, "human")).get();
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  cleanExpired();
  const idx = typingStates.findIndex(
    (t) => t.userId === user.id && t.channelId === body.channel_id
  );
  if (idx !== -1) typingStates.splice(idx, 1);

  return c.json({ typing: false });
});

// GET /typing/:channelId — get who's typing in a channel
app.get("/:channelId", (c) => {
  const auth = c.get("auth");
  const channelId = c.req.param("channelId");

  cleanExpired();
  const typing = typingStates
    .filter((t) => t.channelId === channelId)
    .map((t) => ({ user_id: t.userId, user_name: t.userName }));

  return c.json({ channel_id: channelId, typing });
});

export default app;
