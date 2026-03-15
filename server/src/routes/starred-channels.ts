/**
 * Starred channels — per-user channel favorites.
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { users, channels } from "../db/schema";
import type { AppBindings } from "../types";

// In-memory star store: userId → Set<channelId>
const starredMap = new Map<string, Set<string>>();

function getStarSet(userId: string): Set<string> {
  if (!starredMap.has(userId)) starredMap.set(userId, new Set());
  return starredMap.get(userId)!;
}

const app = new Hono<AppBindings>();

function getCurrentUser(auth: { userId?: string | null }) {
  const db = getDb();
  if (auth.userId) return db.select().from(users).where(eq(users.id, auth.userId)).get() ?? null;
  return db.select().from(users).where(eq(users.type, "human")).get() ?? null;
}

// GET /starred-channels — list starred channel IDs
app.get("/", (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const starred = Array.from(getStarSet(user.id));
  const db = getDb();

  const results = starred
    .map((channelId) => {
      const ch = db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.workspaceId, auth.workspaceId)))
        .get();
      if (!ch) return null;
      return { id: ch.id, name: ch.name, type: ch.type, topic: ch.topic };
    })
    .filter(Boolean);

  return c.json(results);
});

// POST /starred-channels/:channelId — star a channel
app.post("/:channelId", (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const channelId = c.req.param("channelId");
  const db = getDb();
  const ch = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (!ch) return c.json({ detail: "Channel not found" }, 404);

  const stars = getStarSet(user.id);
  if (stars.has(channelId)) {
    return c.json({ detail: "Already starred" }, 409);
  }

  stars.add(channelId);
  return c.json({ channel_id: channelId, starred: true }, 201);
});

// DELETE /starred-channels/:channelId — unstar a channel
app.delete("/:channelId", (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const channelId = c.req.param("channelId");
  const stars = getStarSet(user.id);
  if (!stars.has(channelId)) {
    return c.json({ detail: "Not starred" }, 404);
  }

  stars.delete(channelId);
  return c.json({ channel_id: channelId, starred: false });
});

export default app;
