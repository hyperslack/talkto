/**
 * Message bookmark endpoints — save/unsave/list bookmarked messages.
 */

import { Hono } from "hono";
import { eq, sql, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { messages, users, channels } from "../db/schema";
import type { AppBindings } from "../types";

// ---------------------------------------------------------------------------
// In-memory bookmark store (lightweight, no schema migration needed)
// ---------------------------------------------------------------------------

interface Bookmark {
  userId: string;
  messageId: string;
  channelId: string;
  workspaceId: string;
  note: string | null;
  createdAt: string;
}

const bookmarks: Bookmark[] = [];

const app = new Hono<AppBindings>();

/** Get the current user, returning null if not onboarded. */
function getCurrentUser(auth: { userId?: string | null }) {
  const db = getDb();
  if (auth.userId) {
    return db.select().from(users).where(eq(users.id, auth.userId)).get() ?? null;
  }
  return db.select().from(users).where(eq(users.type, "human")).get() ?? null;
}

// POST /bookmarks — bookmark a message
app.post("/", async (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body || !body.message_id) {
    return c.json({ detail: "message_id is required" }, 400);
  }

  const db = getDb();
  const msg = db.select().from(messages).where(eq(messages.id, body.message_id)).get();
  if (!msg) return c.json({ detail: "Message not found" }, 404);

  // Verify message belongs to current workspace
  const channel = db.select().from(channels).where(
    and(eq(channels.id, msg.channelId), eq(channels.workspaceId, auth.workspaceId))
  ).get();
  if (!channel) return c.json({ detail: "Message not found in workspace" }, 404);

  // Check duplicate
  const existing = bookmarks.find(
    (b) => b.userId === user.id && b.messageId === body.message_id
  );
  if (existing) {
    return c.json({ detail: "Already bookmarked" }, 409);
  }

  const bookmark: Bookmark = {
    userId: user.id,
    messageId: body.message_id,
    channelId: msg.channelId,
    workspaceId: auth.workspaceId,
    note: body.note ?? null,
    createdAt: new Date().toISOString(),
  };
  bookmarks.push(bookmark);

  return c.json({
    message_id: bookmark.messageId,
    channel_id: bookmark.channelId,
    note: bookmark.note,
    created_at: bookmark.createdAt,
  }, 201);
});

// DELETE /bookmarks/:messageId — remove bookmark
app.delete("/:messageId", (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const messageId = c.req.param("messageId");
  const idx = bookmarks.findIndex(
    (b) => b.userId === user.id && b.messageId === messageId
  );
  if (idx === -1) return c.json({ detail: "Bookmark not found" }, 404);

  bookmarks.splice(idx, 1);
  return c.body(null, 204);
});

// GET /bookmarks — list user's bookmarks
app.get("/", (c) => {
  const auth = c.get("auth");
  const user = getCurrentUser(auth);
  if (!user) return c.json({ detail: "No user onboarded" }, 404);

  const db = getDb();
  const userBookmarks = bookmarks
    .filter((b) => b.userId === user.id && b.workspaceId === auth.workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const results = userBookmarks.map((b) => {
    const msg = db.select({
      content: messages.content,
      senderName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      channelName: channels.name,
    })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(eq(messages.id, b.messageId))
      .get();

    return {
      message_id: b.messageId,
      channel_id: b.channelId,
      channel_name: msg?.channelName ?? null,
      sender_name: msg?.senderName ?? null,
      content_preview: msg?.content?.slice(0, 200) ?? null,
      note: b.note,
      created_at: b.createdAt,
    };
  });

  return c.json(results);
});

export default app;

// Export for testing
export { bookmarks as _bookmarks };
