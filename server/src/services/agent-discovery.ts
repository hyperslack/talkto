/**
 * Agent discovery — resolve stored invocation info.
 *
 * For subprocess providers, TalkTo trusts registration-time verification
 * and keeps persisted credentials until a real invoke fails.
 * Failure-time cleanup removes unreachable agents entirely instead of
 * keeping stale offline shells in the workspace.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { agents, sessions } from "../db/schema";
import { deleteAgentFromWorkspace } from "./admin-manager";

// ---------------------------------------------------------------------------
// Invocation info resolution
// ---------------------------------------------------------------------------

export interface InvocationInfo {
  serverUrl: string | null;
  sessionId: string;
  projectPath: string;
  agentType: string;
}

/** Look up an agent's stored invocation details. */
export async function getAgentInvocationInfo(
  agentName: string
): Promise<InvocationInfo | null> {
  const db = getDb();

  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, agentName))
    .get();

  if (!agent) {
    console.log(`[DISCOVERY] Agent '${agentName}' not found in DB`);
    return null;
  }

  if (agent.agentType === "system") {
    console.log(`[DISCOVERY] '${agentName}' is a system agent — not invocable`);
    return null;
  }

  if (agent.providerSessionId) {
    console.log(
      `[DISCOVERY] '${agentName}' has stored credentials: type=${agent.agentType} server=${agent.serverUrl ?? "n/a"} session=${agent.providerSessionId}`
    );
    return {
      serverUrl: agent.serverUrl ?? null,
      sessionId: agent.providerSessionId,
      projectPath: agent.projectPath,
      agentType: agent.agentType,
    };
  }

  console.log(
    `[DISCOVERY] '${agentName}' has no stored invocation credentials — not invocable.`
  );
  return null;
}

/** Remove an unreachable agent after a real provider failure. */
export function clearStaleCredentials(agentName: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, agentName))
    .get();

  if (agent) {
    db.update(sessions)
      .set({ isActive: 0, endedAt: now })
      .where(and(eq(sessions.agentId, agent.id), eq(sessions.isActive, 1)))
      .run();

    const result = deleteAgentFromWorkspace(agent);
    if (result.error) {
      console.error(
        `[DISCOVERY] Failed to delete unreachable agent '${agentName}': ${result.error}`
      );
      return;
    }
    console.log(
      `[DISCOVERY] Removed unreachable agent '${agentName}' after provider failure`
    );
  }
}

/** Check if an agent currently lacks invocable credentials. */
export async function isAgentGhost(agentName: string): Promise<boolean> {
  const db = getDb();

  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, agentName))
    .get();

  if (!agent) return false;
  if (agent.agentType === "system") return false;

  if (agent.agentType === "opencode") {
    return !(agent.serverUrl && agent.providerSessionId);
  }

  return !agent.providerSessionId;
}
