import { describe, test, expect } from "bun:test";
import {
  AgentErrorTracker,
  classifyError,
  healthScore,
  healthLabel,
  formatError,
} from "../src/lib/agent-error-tracker";

describe("AgentErrorTracker", () => {
  test("records and retrieves errors", () => {
    const tracker = new AgentErrorTracker();
    tracker.record({ agentId: "a1", agentName: "claude", category: "timeout", message: "Timed out" });
    tracker.record({ agentId: "a1", agentName: "claude", category: "crash", message: "Process killed" });

    const errors = tracker.getErrors("a1");
    expect(errors).toHaveLength(2);
    expect(errors[0].category).toBe("timeout");
    expect(errors[1].category).toBe("crash");
  });

  test("respects maxErrors capacity", () => {
    const tracker = new AgentErrorTracker(5);
    for (let i = 0; i < 10; i++) {
      tracker.record({ agentId: "a1", agentName: "bot", category: "unknown", message: `Error ${i}` });
    }
    expect(tracker.size()).toBe(5);
  });

  test("getRecent filters by time window", () => {
    const tracker = new AgentErrorTracker();
    tracker.record({ agentId: "a1", agentName: "bot", category: "timeout", message: "err" });
    const recent = tracker.getRecent(3600000);
    expect(recent.length).toBeGreaterThanOrEqual(1);
  });

  test("getStats computes error statistics", () => {
    const tracker = new AgentErrorTracker();
    tracker.record({ agentId: "a1", agentName: "claude", category: "timeout", message: "err1" });
    tracker.record({ agentId: "a1", agentName: "claude", category: "timeout", message: "err2" });
    tracker.record({ agentId: "a1", agentName: "claude", category: "crash", message: "err3" });

    const stats = tracker.getStats("a1", "claude");
    expect(stats.totalErrors).toBe(3);
    expect(stats.errorsByCategory.timeout).toBe(2);
    expect(stats.errorsByCategory.crash).toBe(1);
    expect(stats.lastErrorAt).not.toBeNull();
    expect(stats.errorRate).toBeGreaterThan(0);
  });

  test("clearAgent removes only that agent's errors", () => {
    const tracker = new AgentErrorTracker();
    tracker.record({ agentId: "a1", agentName: "claude", category: "timeout", message: "err" });
    tracker.record({ agentId: "a2", agentName: "codex", category: "crash", message: "err" });

    const removed = tracker.clearAgent("a1");
    expect(removed).toBe(1);
    expect(tracker.size()).toBe(1);
    expect(tracker.getErrors("a2")).toHaveLength(1);
  });

  test("clearAll empties the store", () => {
    const tracker = new AgentErrorTracker();
    tracker.record({ agentId: "a1", agentName: "bot", category: "unknown", message: "err" });
    tracker.clearAll();
    expect(tracker.size()).toBe(0);
  });
});

describe("classifyError", () => {
  test("classifies timeout errors", () => {
    expect(classifyError("Request timed out after 30s")).toBe("timeout");
  });

  test("classifies crash errors", () => {
    expect(classifyError("Process killed by signal")).toBe("crash");
  });

  test("classifies rate limit errors", () => {
    expect(classifyError("429 Too Many Requests")).toBe("rate_limit");
  });

  test("classifies auth errors", () => {
    expect(classifyError("401 Unauthorized")).toBe("auth");
  });

  test("classifies parse errors", () => {
    expect(classifyError("JSON syntax error")).toBe("parse");
  });

  test("classifies network errors", () => {
    expect(classifyError("ECONNREFUSED 127.0.0.1:3000")).toBe("network");
  });

  test("defaults to unknown", () => {
    expect(classifyError("Something weird happened")).toBe("unknown");
  });
});

describe("healthScore", () => {
  test("returns 100 for zero errors", () => {
    expect(healthScore(0)).toBe(100);
  });

  test("returns 0 for high error rate", () => {
    expect(healthScore(10)).toBe(0);
  });

  test("returns intermediate values", () => {
    expect(healthScore(3)).toBe(70);
  });
});

describe("healthLabel", () => {
  test("returns correct labels", () => {
    expect(healthLabel(95)).toBe("healthy");
    expect(healthLabel(75)).toBe("degraded");
    expect(healthLabel(50)).toBe("unhealthy");
    expect(healthLabel(20)).toBe("critical");
  });
});

describe("formatError", () => {
  test("formats error for display", () => {
    const error = {
      id: "test",
      agentId: "a1",
      agentName: "claude",
      category: "timeout" as const,
      message: "Timed out",
      occurredAt: new Date().toISOString(),
    };
    const formatted = formatError(error);
    expect(formatted).toContain("claude");
    expect(formatted).toContain("timeout");
    expect(formatted).toContain("Timed out");
  });
});
