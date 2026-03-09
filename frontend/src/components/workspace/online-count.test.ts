/**
 * Tests for online member count logic.
 */

import { describe, expect, it } from "bun:test";

interface AgentLike {
  agent_name: string;
  status: string;
  is_ghost: boolean;
}

function computeOnlineCount(
  agents: AgentLike[],
  agentStatuses: Map<string, string>,
): { online: number; total: number } {
  const nonGhost = agents.filter((a) => !a.is_ghost);
  const online = nonGhost.filter(
    (a) => (agentStatuses.get(a.agent_name) ?? a.status) === "online"
  ).length + 1; // +1 for human
  const total = nonGhost.length + 1; // +1 for human
  return { online, total };
}

describe("Online member count", () => {
  it("counts human + online agents", () => {
    const agents: AgentLike[] = [
      { agent_name: "agent1", status: "online", is_ghost: false },
      { agent_name: "agent2", status: "offline", is_ghost: false },
    ];
    const statuses = new Map<string, string>();
    const { online, total } = computeOnlineCount(agents, statuses);
    expect(online).toBe(2); // human + agent1
    expect(total).toBe(3); // human + 2 agents
  });

  it("overrides status from agentStatuses map", () => {
    const agents: AgentLike[] = [
      { agent_name: "agent1", status: "offline", is_ghost: false },
    ];
    const statuses = new Map([["agent1", "online"]]);
    const { online } = computeOnlineCount(agents, statuses);
    expect(online).toBe(2); // human + agent1 (overridden to online)
  });

  it("excludes ghost agents", () => {
    const agents: AgentLike[] = [
      { agent_name: "agent1", status: "online", is_ghost: false },
      { agent_name: "ghost1", status: "online", is_ghost: true },
    ];
    const { online, total } = computeOnlineCount(agents, new Map());
    expect(online).toBe(2); // human + agent1
    expect(total).toBe(2); // human + agent1 (ghost excluded)
  });

  it("handles empty agents list", () => {
    const { online, total } = computeOnlineCount([], new Map());
    expect(online).toBe(1); // just the human
    expect(total).toBe(1);
  });
});
