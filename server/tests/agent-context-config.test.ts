import { describe, test, expect } from "bun:test";
import {
  AgentContextConfigStore,
  applyContextWindow,
} from "../src/lib/agent-context-config";

describe("AgentContextConfigStore", () => {
  test("returns defaults for unconfigured agent", () => {
    const store = new AgentContextConfigStore();
    const config = store.getConfig("agent1");
    expect(config.maxMessages).toBe(20);
    expect(config.maxChars).toBe(8000);
  });

  test("sets and retrieves agent overrides", () => {
    const store = new AgentContextConfigStore();
    store.setConfig("agent1", { maxMessages: 50, includeSystemMessages: true });
    const config = store.getConfig("agent1");
    expect(config.maxMessages).toBe(50);
    expect(config.includeSystemMessages).toBe(true);
    expect(config.maxChars).toBe(8000); // default preserved
  });

  test("clamps values to valid ranges", () => {
    const store = new AgentContextConfigStore();
    store.setConfig("agent1", { maxMessages: 500, maxChars: 50 });
    const config = store.getConfig("agent1");
    expect(config.maxMessages).toBe(100);
    expect(config.maxChars).toBe(100);
  });

  test("resets agent config", () => {
    const store = new AgentContextConfigStore();
    store.setConfig("agent1", { maxMessages: 50 });
    store.resetConfig("agent1");
    expect(store.getConfig("agent1").maxMessages).toBe(20);
    expect(store.hasCustomConfig("agent1")).toBe(false);
  });

  test("lists customized agents", () => {
    const store = new AgentContextConfigStore();
    store.setConfig("a1", { maxMessages: 10 });
    store.setConfig("a2", { maxMessages: 30 });
    expect(store.listCustomized()).toEqual(["a1", "a2"]);
  });

  test("supports custom global defaults", () => {
    const store = new AgentContextConfigStore({ maxMessages: 10, maxChars: 4000 });
    expect(store.getDefaults().maxMessages).toBe(10);
    expect(store.getDefaults().maxChars).toBe(4000);
  });

  test("updates global defaults", () => {
    const store = new AgentContextConfigStore();
    store.setDefaults({ maxMessages: 30 });
    expect(store.getDefaults().maxMessages).toBe(30);
  });
});

describe("applyContextWindow", () => {
  const now = new Date().toISOString();
  const oldTime = new Date(Date.now() - 3600000 * 24).toISOString();

  const messages = [
    { content: "System boot", senderType: "system" as const, isPinned: false, createdAt: now },
    { content: "Hello from human", senderType: "human" as const, isPinned: false, createdAt: now },
    { content: "Agent response", senderType: "agent" as const, isPinned: false, createdAt: now },
    { content: "Pinned note", senderType: "human" as const, isPinned: true, createdAt: oldTime },
    { content: "Another msg", senderType: "human" as const, isPinned: false, createdAt: now },
  ];

  test("limits by maxMessages", () => {
    const config = { maxMessages: 2, maxChars: 100000, includeSystemMessages: true, includeAgentMessages: true, includePinned: true, timeWindowMinutes: null };
    const result = applyContextWindow(messages, config);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("excludes system messages when configured", () => {
    const config = { maxMessages: 100, maxChars: 100000, includeSystemMessages: false, includeAgentMessages: true, includePinned: false, timeWindowMinutes: null };
    const result = applyContextWindow(messages, config);
    expect(result.every((m) => m.senderType !== "system")).toBe(true);
  });

  test("excludes agent messages when configured", () => {
    const config = { maxMessages: 100, maxChars: 100000, includeSystemMessages: true, includeAgentMessages: false, includePinned: false, timeWindowMinutes: null };
    const result = applyContextWindow(messages, config);
    expect(result.every((m) => m.senderType !== "agent")).toBe(true);
  });

  test("respects character limit", () => {
    const config = { maxMessages: 100, maxChars: 30, includeSystemMessages: true, includeAgentMessages: true, includePinned: true, timeWindowMinutes: null };
    const result = applyContextWindow(messages, config);
    const totalChars = result.reduce((sum, m) => sum + m.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(30);
  });

  test("preserves pinned messages despite time window", () => {
    const config = { maxMessages: 100, maxChars: 100000, includeSystemMessages: true, includeAgentMessages: true, includePinned: true, timeWindowMinutes: 60 };
    const result = applyContextWindow(messages, config);
    expect(result.some((m) => m.isPinned)).toBe(true);
  });
});
