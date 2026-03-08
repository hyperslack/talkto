/**
 * Channel session persistence helpers.
 *
 * A channel session groups related messages inside a channel so the UI can
 * retrieve a stable history for one conversation turn or proactive thread.
 */

import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { channelSessions, messages } from "../db/schema";

const SESSION_PREVIEW_LIMIT = 280;

function buildPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, SESSION_PREVIEW_LIMIT);
}

export function startChannelSession(
  channelId: string,
  senderId: string,
  content: string,
  createdAt: string
): string {
  const db = getDb();
  const sessionId = crypto.randomUUID();

  db.insert(channelSessions)
    .values({
      id: sessionId,
      channelId,
      rootMessageId: null,
      rootSenderId: senderId,
      rootPreview: buildPreview(content),
      createdAt,
    })
    .run();

  return sessionId;
}

export function attachRootMessageToSession(
  sessionId: string,
  messageId: string
): void {
  const db = getDb();
  db.update(channelSessions)
    .set({ rootMessageId: messageId })
    .where(eq(channelSessions.id, sessionId))
    .run();
}

export function getMessageChannelSessionId(messageId: string): string | null {
  const db = getDb();
  const row = db
    .select({ channelSessionId: messages.channelSessionId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .get();
  return row?.channelSessionId ?? null;
}

export function resolveChannelSessionForWrite(opts: {
  channelId: string;
  senderId: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
}): { sessionId: string; startedNew: boolean } {
  const db = getDb();
  const parentId = opts.parentId ?? null;

  if (parentId) {
    const parent = db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        senderId: messages.senderId,
        content: messages.content,
        createdAt: messages.createdAt,
        channelSessionId: messages.channelSessionId,
      })
      .from(messages)
      .where(eq(messages.id, parentId))
      .get();

    if (parent?.channelSessionId) {
      return { sessionId: parent.channelSessionId, startedNew: false };
    }

    if (parent) {
      const sessionId = startChannelSession(
        parent.channelId,
        parent.senderId,
        parent.content,
        parent.createdAt
      );
      attachRootMessageToSession(sessionId, parent.id);
      db.update(messages)
        .set({ channelSessionId: sessionId })
        .where(eq(messages.id, parent.id))
        .run();
      return { sessionId, startedNew: false };
    }
  }

  const sessionId = startChannelSession(
    opts.channelId,
    opts.senderId,
    opts.content,
    opts.createdAt
  );
  return { sessionId, startedNew: true };
}

export function cleanupChannelSessionAfterMessageDelete(
  sessionId: string | null | undefined,
  deletedMessageId: string
): void {
  if (!sessionId) return;

  const db = getDb();
  const remaining = db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.channelSessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all();

  if (remaining.length === 0) {
    db.delete(channelSessions).where(eq(channelSessions.id, sessionId)).run();
    return;
  }

  const session = db
    .select({
      rootMessageId: channelSessions.rootMessageId,
    })
    .from(channelSessions)
    .where(eq(channelSessions.id, sessionId))
    .get();

  if (session?.rootMessageId !== deletedMessageId) {
    return;
  }

  const replacement = remaining[0];
  db.update(channelSessions)
    .set({
      rootMessageId: replacement.id,
      rootSenderId: replacement.senderId,
      rootPreview: buildPreview(replacement.content),
    })
    .where(eq(channelSessions.id, sessionId))
    .run();
}

export function backfillChannelSessionsForMessages(): void {
  const db = getDb();
  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(sql`${messages.channelSessionId} IS NULL`)
    .get();

  if (!countRow || countRow.count === 0) return;

  const rows = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      senderId: messages.senderId,
      content: messages.content,
      parentId: messages.parentId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(sql`${messages.channelSessionId} IS NULL`)
    .orderBy(asc(messages.createdAt))
    .all();

  for (const row of rows) {
    const { sessionId, startedNew } = resolveChannelSessionForWrite({
      channelId: row.channelId,
      senderId: row.senderId,
      content: row.content,
      createdAt: row.createdAt,
      parentId: row.parentId,
    });

    db.update(messages)
      .set({ channelSessionId: sessionId })
      .where(eq(messages.id, row.id))
      .run();

    if (startedNew) {
      attachRootMessageToSession(sessionId, row.id);
    }
  }
}
