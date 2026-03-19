/**
 * Agent presence summary utilities — builds workspace-level summaries
 * of agent availability for sidebar indicators and status bars.
 */

export interface AgentInfo {
  agent_name: string;
  status: "online" | "offline";
  agent_type: string;
  is_ghost?: boolean;
  current_task?: string | null;
}

export interface PresenceSummary {
  online: number;
  offline: number;
  total: number;
  ghosts: number;
  activeAgents: string[];      // names of online non-ghost agents
  busyAgents: string[];        // names of agents with a current_task
  availableAgents: string[];   // online, not ghost, no current task
}

/**
 * Build a presence summary from a list of agents.
 */
export function buildPresenceSummary(agents: AgentInfo[]): PresenceSummary {
  let online = 0;
  let offline = 0;
  let ghosts = 0;
  const activeAgents: string[] = [];
  const busyAgents: string[] = [];
  const availableAgents: string[] = [];

  for (const agent of agents) {
    if (agent.is_ghost) {
      ghosts++;
      continue;
    }

    if (agent.status === "online") {
      online++;
      activeAgents.push(agent.agent_name);
      if (agent.current_task) {
        busyAgents.push(agent.agent_name);
      } else {
        availableAgents.push(agent.agent_name);
      }
    } else {
      offline++;
    }
  }

  return {
    online,
    offline,
    total: agents.length - ghosts,
    ghosts,
    activeAgents,
    busyAgents,
    availableAgents,
  };
}

/**
 * Format presence as a compact status line (e.g., "3 online · 2 busy").
 */
export function formatPresenceLine(summary: PresenceSummary): string {
  const parts: string[] = [];
  if (summary.online > 0) parts.push(`${summary.online} online`);
  if (summary.busyAgents.length > 0) parts.push(`${summary.busyAgents.length} busy`);
  if (summary.offline > 0) parts.push(`${summary.offline} offline`);
  if (parts.length === 0) return "No agents";
  return parts.join(" · ");
}

/**
 * Get a status dot color for the overall workspace agent health.
 */
export function workspaceStatusColor(summary: PresenceSummary): "green" | "yellow" | "red" | "gray" {
  if (summary.total === 0) return "gray";
  if (summary.online === 0) return "red";
  if (summary.online < summary.total) return "yellow";
  return "green";
}

/**
 * Get a short status emoji for the workspace.
 */
export function workspaceStatusEmoji(summary: PresenceSummary): string {
  const color = workspaceStatusColor(summary);
  return { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚫" }[color];
}

/**
 * Format individual agent status for display.
 */
export function formatAgentStatus(agent: AgentInfo): string {
  if (agent.is_ghost) return `👻 ${agent.agent_name} (ghost)`;
  const dot = agent.status === "online" ? "🟢" : "⚫";
  const task = agent.current_task ? ` — ${agent.current_task}` : "";
  return `${dot} ${agent.agent_name}${task}`;
}

/**
 * Group agents by their type.
 */
export function groupByType(agents: AgentInfo[]): Record<string, AgentInfo[]> {
  const groups: Record<string, AgentInfo[]> = {};
  for (const agent of agents) {
    const type = agent.agent_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(agent);
  }
  return groups;
}
