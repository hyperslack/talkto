/**
 * Startup/app-load reconciliation for persisted agent credentials.
 *
 * Active agents are the agents whose stored provider session IDs can still be
 * reached through cheap provider-backed checks. Anything else is removed.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { agents } from "../db/schema";
import type { ClaudeSessionRecord } from "../sdk/claude";
import { hasRecoverableClaudeSession, readClaudeSessionIndex } from "../sdk/claude";
import { hasRecoverableCodexSession, readCodexSessionIndex } from "../sdk/codex";
import { hasRecoverableCursorSession, readCursorSessionIndex } from "../sdk/cursor";
import { isSessionAlive as isOpenCodeSessionAlive } from "../sdk/opencode";
import { deleteAgentFromWorkspace } from "./admin-manager";

export interface AgentReconciliationReport {
  checked: number;
  kept: number;
  deleted: number;
  agent_names: string[];
  errors: string[];
}

function emptyReport(): AgentReconciliationReport {
  return {
    checked: 0,
    kept: 0,
    deleted: 0,
    agent_names: [],
    errors: [],
  };
}

async function isAgentReachable(
  agent: typeof agents.$inferSelect,
  indexes: {
    claude: Map<string, ClaudeSessionRecord[]>;
    codex: Set<string>;
    cursor: Map<string, Set<string>>;
  }
): Promise<boolean> {
  if (agent.agentType === "system") {
    return false;
  }

  if (agent.agentType === "opencode") {
    if (!(agent.serverUrl && agent.providerSessionId)) return false;
    return isOpenCodeSessionAlive(agent.serverUrl, agent.providerSessionId);
  }

  if (!agent.providerSessionId) {
    return false;
  }

  switch (agent.agentType) {
    case "claude_code":
      return hasRecoverableClaudeSession(agent.providerSessionId, agent.projectPath, indexes.claude);
    case "codex":
      return hasRecoverableCodexSession(agent.providerSessionId, indexes.codex);
    case "cursor":
      return hasRecoverableCursorSession(agent.providerSessionId, agent.projectPath, indexes.cursor);
    default:
      return false;
  }
}

async function reconcileAgents(
  allAgents: Array<typeof agents.$inferSelect>
): Promise<AgentReconciliationReport> {
  const report = emptyReport();
  const candidates = allAgents.filter((agent) => agent.agentType !== "system");
  if (candidates.length === 0) return report;

  const claudeIndex = readClaudeSessionIndex();
  const codexIndex = readCodexSessionIndex();
  const cursorIndex = readCursorSessionIndex();

  const results = await Promise.allSettled(
    candidates.map(async (agent) => {
      const reachable = await isAgentReachable(agent, {
        claude: claudeIndex,
        codex: codexIndex,
        cursor: cursorIndex,
      });
      return { agent, reachable };
    })
  );

  for (const result of results) {
    report.checked += 1;

    if (result.status !== "fulfilled") {
      report.errors.push(String(result.reason));
      continue;
    }

    const { agent, reachable } = result.value;
    if (reachable) {
      report.kept += 1;
      continue;
    }

    const deletion = deleteAgentFromWorkspace(agent);
    if ("error" in deletion && deletion.error) {
      report.errors.push(`${agent.agentName}: ${deletion.error}`);
      continue;
    }

    report.deleted += 1;
    report.agent_names.push(agent.agentName);
  }

  return report;
}

export async function reconcileWorkspaceAgents(
  workspaceId: string
): Promise<AgentReconciliationReport> {
  const db = getDb();
  const allAgents = db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
    .all();

  return reconcileAgents(allAgents);
}

export async function reconcileAllAgents(): Promise<AgentReconciliationReport> {
  const db = getDb();
  const allAgents = db.select().from(agents).all();
  return reconcileAgents(allAgents);
}
