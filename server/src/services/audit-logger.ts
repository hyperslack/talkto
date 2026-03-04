/**
 * Audit logger — records workspace actions for accountability and debugging.
 */

import { getDb } from "../db";
import { auditLog } from "../db/schema";

export interface AuditEntry {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Record an audit log entry. Fire-and-forget — never throws.
 */
export function logAudit(entry: AuditEntry): void {
  try {
    const db = getDb();
    db.insert(auditLog)
      .values({
        id: crypto.randomUUID(),
        workspaceId: entry.workspaceId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    console.error("[AUDIT] Failed to log:", err);
  }
}
