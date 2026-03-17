import { describe, it, expect, beforeEach } from "vitest";
import { AgentStatusHistory } from "../src/utils/agent-status-history";

describe("AgentStatusHistory", () => {
  let tracker: AgentStatusHistory;

  beforeEach(() => {
    tracker = new AgentStatusHistory();
  });

  it("records a status change", () => {
    const entry = tracker.record("agent-1", "online");
    expect(entry.agentName).toBe("agent-1");
    expect(entry.status).toBe("online");
    expect(entry.previousStatus).toBeNull();
  });

  it("tracks previous status", () => {
    tracker.record("agent-1", "online");
    const entry = tracker.record("agent-1", "offline");
    expect(entry.previousStatus).toBe("online");
    expect(entry.sessionDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("getCurrent returns current status", () => {
    tracker.record("agent-1", "online");
    expect(tracker.getCurrent("agent-1")).toBe("online");
    tracker.record("agent-1", "offline");
    expect(tracker.getCurrent("agent-1")).toBe("offline");
  });

  it("getCurrent returns null for unknown agent", () => {
    expect(tracker.getCurrent("nope")).toBeNull();
  });

  it("getHistory returns entries for an agent", () => {
    tracker.record("agent-1", "online");
    tracker.record("agent-2", "online");
    tracker.record("agent-1", "offline");
    expect(tracker.getHistory("agent-1")).toHaveLength(2);
    expect(tracker.getHistory("agent-2")).toHaveLength(1);
  });

  it("getHistory respects limit", () => {
    tracker.record("a", "online");
    tracker.record("a", "offline");
    tracker.record("a", "online");
    expect(tracker.getHistory("a", 2)).toHaveLength(2);
  });

  it("computeUptime returns null for unknown", () => {
    expect(tracker.computeUptime("nope")).toBeNull();
  });

  it("computeUptime computes metrics", () => {
    tracker.record("a", "online");
    tracker.record("a", "offline");
    tracker.record("a", "online");
    const summary = tracker.computeUptime("a");
    expect(summary).not.toBeNull();
    expect(summary!.agentName).toBe("a");
    expect(summary!.lastStatus).toBe("online");
    expect(summary!.transitionCount).toBe(2);
  });

  it("trackedAgents lists all agents", () => {
    tracker.record("a", "online");
    tracker.record("b", "offline");
    expect(tracker.trackedAgents().sort()).toEqual(["a", "b"]);
  });

  it("size reflects entry count", () => {
    tracker.record("a", "online");
    tracker.record("a", "offline");
    expect(tracker.size()).toBe(2);
  });

  it("sessionDurationMs is null for non-offline transitions", () => {
    tracker.record("a", "offline");
    const entry = tracker.record("a", "online");
    expect(entry.sessionDurationMs).toBeNull();
  });

  it("clear resets everything", () => {
    tracker.record("a", "online");
    tracker.clear();
    expect(tracker.size()).toBe(0);
    expect(tracker.getCurrent("a")).toBeNull();
  });
});
