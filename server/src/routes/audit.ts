/**
 * Audit log endpoints — view workspace activity history.
 */

import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { auditLog, users } from "../db/schema";
import type { AppBindings } from "../types";

const app = new Hono<AppBindings>();

// GET /audit — list audit log entries for the workspace
app.get("/", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 200);
  const actionFilter = c.req.query("action"); // optional filter by action type

  const conditions = [eq(auditLog.workspaceId, auth.workspaceId)];
  if (actionFilter) {
    conditions.push(eq(auditLog.action, actionFilter));
  }

  const rows = db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: sql<string>`coalesce(${users.displayName}, ${users.name})`,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .all();

  const result = rows.map((row) => ({
    id: row.id,
    actor_id: row.actorId,
    actor_name: row.actorName ?? null,
    action: row.action,
    target_type: row.targetType,
    target_id: row.targetId,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    created_at: row.createdAt,
  }));

  return c.json(result);
});

export default app;
