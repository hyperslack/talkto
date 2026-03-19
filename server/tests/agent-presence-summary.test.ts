import { describe, it, expect } from "bun:test";
import {
  buildPresenceSummary,
  formatPresenceLine,
  workspaceStatusColor,
  workspaceStatusEmoji,
  formatAgentStatus,
  groupByType,
} from "../src/utils/agent-presence-summary";

const agents = [
  { agent_name: "claude", status: "online" as const, agent_type: "claude_code", current_task: null },
  { agent_name: "codex", status: "online" as const, agent_type: "codex", current_task: "Fixing tests" },
  { agent_name: "cursor", status: "offline" as const, agent_type: "cursor", current_task: null },
  { agent_name: "ghost1", status: "offline" as const, agent_type: "system", is_ghost: true },
];

describe("buildPresenceSummary", () => {
  it("counts online/offline/ghosts correctly", () => {
    const summary = buildPresenceSummary(agents);
    expect(summary.online).toBe(2);
    expect(summary.offline).toBe(1);
    expect(summary.ghosts).toBe(1);
    expect(summary.total).toBe(3); // excludes ghosts
  });

  it("identifies active, busy, and available agents", () => {
    const summary = buildPresenceSummary(agents);
    expect(summary.activeAgents).toEqual(["claude", "codex"]);
    expect(summary.busyAgents).toEqual(["codex"]);
    expect(summary.availableAgents).toEqual(["claude"]);
  });

  it("handles empty list", () => {
    const summary = buildPresenceSummary([]);
    expect(summary.online).toBe(0);
    expect(summary.total).toBe(0);
  });
});

describe("formatPresenceLine", () => {
  it("formats with all parts", () => {
    const summary = buildPresenceSummary(agents);
    const line = formatPresenceLine(summary);
    expect(line).toContain("2 online");
    expect(line).toContain("1 busy");
    expect(line).toContain("1 offline");
  });

  it("returns No agents for empty", () => {
    const summary = buildPresenceSummary([]);
    expect(formatPresenceLine(summary)).toBe("No agents");
  });
});

describe("workspaceStatusColor", () => {
  it("returns green when all online", () => {
    const summary = buildPresenceSummary([
      { agent_name: "a", status: "online", agent_type: "x" },
    ]);
    expect(workspaceStatusColor(summary)).toBe("green");
  });

  it("returns yellow when partial", () => {
    const summary = buildPresenceSummary(agents);
    expect(workspaceStatusColor(summary)).toBe("yellow");
  });

  it("returns red when all offline", () => {
    const summary = buildPresenceSummary([
      { agent_name: "a", status: "offline", agent_type: "x" },
    ]);
    expect(workspaceStatusColor(summary)).toBe("red");
  });

  it("returns gray for no agents", () => {
    const summary = buildPresenceSummary([]);
    expect(workspaceStatusColor(summary)).toBe("gray");
  });
});

describe("workspaceStatusEmoji", () => {
  it("returns green circle for all online", () => {
    const summary = buildPresenceSummary([
      { agent_name: "a", status: "online", agent_type: "x" },
    ]);
    expect(workspaceStatusEmoji(summary)).toBe("🟢");
  });
});

describe("formatAgentStatus", () => {
  it("formats online agent", () => {
    expect(formatAgentStatus(agents[0])).toBe("🟢 claude");
  });

  it("formats busy agent with task", () => {
    expect(formatAgentStatus(agents[1])).toContain("Fixing tests");
  });

  it("formats ghost agent", () => {
    expect(formatAgentStatus(agents[3])).toContain("ghost");
    expect(formatAgentStatus(agents[3])).toContain("👻");
  });
});

describe("groupByType", () => {
  it("groups agents by type", () => {
    const groups = groupByType(agents);
    expect(Object.keys(groups).sort()).toEqual(["claude_code", "codex", "cursor", "system"]);
    expect(groups["claude_code"]).toHaveLength(1);
  });
});
