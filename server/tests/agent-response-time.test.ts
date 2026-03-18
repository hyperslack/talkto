import { describe, expect, test } from "bun:test";
import {
  AgentResponseTimeTracker,
  computeStats,
  formatDuration,
} from "../src/utils/agent-response-time";

describe("Agent Response Time Tracker", () => {
  test("records and retrieves samples", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("agent-1", 100);
    tracker.record("agent-1", 200);
    expect(tracker.getSamples("agent-1")).toHaveLength(2);
  });

  test("returns empty for unknown agent", () => {
    const tracker = new AgentResponseTimeTracker();
    expect(tracker.getSamples("unknown")).toEqual([]);
  });

  test("ignores negative durations", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("agent-1", -50);
    expect(tracker.getSamples("agent-1")).toHaveLength(0);
  });

  test("enforces max samples limit", () => {
    const tracker = new AgentResponseTimeTracker(3);
    tracker.record("a", 100);
    tracker.record("a", 200);
    tracker.record("a", 300);
    tracker.record("a", 400);
    expect(tracker.getSamples("a")).toHaveLength(3);
    expect(tracker.getSamples("a")[0].durationMs).toBe(200); // oldest dropped
  });

  test("computes stats correctly", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("a", 100);
    tracker.record("a", 200);
    tracker.record("a", 300);
    const stats = tracker.getStats("a");
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(3);
    expect(stats!.avgMs).toBe(200);
    expect(stats!.minMs).toBe(100);
    expect(stats!.maxMs).toBe(300);
    expect(stats!.medianMs).toBe(200);
  });

  test("returns null stats for unknown agent", () => {
    const tracker = new AgentResponseTimeTracker();
    expect(tracker.getStats("nope")).toBeNull();
  });

  test("getAllStats returns all agents", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("a", 100);
    tracker.record("b", 200);
    const all = tracker.getAllStats();
    expect(all.size).toBe(2);
  });

  test("getFastest returns agent with lowest avg", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("slow", 500);
    tracker.record("fast", 50);
    const fastest = tracker.getFastest();
    expect(fastest!.agentId).toBe("fast");
  });

  test("getSlowest returns agent with highest avg", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("slow", 500);
    tracker.record("fast", 50);
    const slowest = tracker.getSlowest();
    expect(slowest!.agentId).toBe("slow");
  });

  test("trackedAgents lists all IDs", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("x", 10);
    tracker.record("y", 20);
    expect(tracker.trackedAgents().sort()).toEqual(["x", "y"]);
  });

  test("clear removes agent data", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("a", 100);
    tracker.clear("a");
    expect(tracker.getSamples("a")).toEqual([]);
  });

  test("clearAll removes everything", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("a", 100);
    tracker.record("b", 200);
    tracker.clearAll();
    expect(tracker.trackedAgents()).toEqual([]);
  });

  test("sampleCount returns correct count", () => {
    const tracker = new AgentResponseTimeTracker();
    tracker.record("a", 100);
    tracker.record("a", 200);
    expect(tracker.sampleCount("a")).toBe(2);
    expect(tracker.sampleCount("b")).toBe(0);
  });
});

describe("computeStats", () => {
  test("computes all fields", () => {
    const stats = computeStats([10, 20, 30, 40, 50]);
    expect(stats.count).toBe(5);
    expect(stats.avgMs).toBe(30);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(50);
  });
});

describe("formatDuration", () => {
  test("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  test("formats seconds", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });

  test("formats minutes", () => {
    expect(formatDuration(90000)).toBe("1.5m");
  });
});
