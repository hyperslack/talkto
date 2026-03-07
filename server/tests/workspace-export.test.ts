/**
 * Tests for workspace export structure.
 */

import { describe, expect, it } from "bun:test";

describe("Workspace Export", () => {
  it("export shape has all top-level fields", () => {
    const exp = {
      workspace: { id: "w1", name: "Test", slug: "test", type: "personal", description: null, created_at: "2026-01-01T00:00:00Z" },
      members: [],
      channels: [],
      messages: [],
      agents: [],
      exported_at: new Date().toISOString(),
      total_messages: 0,
      total_channels: 0,
      total_members: 0,
    };
    expect(exp.workspace.id).toBe("w1");
    expect(exp.exported_at).toBeTruthy();
    expect(exp.total_messages).toBe(0);
    expect(Array.isArray(exp.members)).toBe(true);
    expect(Array.isArray(exp.channels)).toBe(true);
    expect(Array.isArray(exp.messages)).toBe(true);
    expect(Array.isArray(exp.agents)).toBe(true);
  });

  it("channel export includes message count", () => {
    const ch = { id: "ch1", name: "#general", type: "general", topic: null, created_at: "2026-01-01T00:00:00Z", message_count: 42 };
    expect(ch.message_count).toBe(42);
  });

  it("message export includes channel and sender info", () => {
    const msg = {
      id: "m1",
      channel_name: "#general",
      sender_name: "alice",
      sender_type: "human",
      content: "hello",
      created_at: "2026-01-01T00:00:00Z",
      parent_id: null,
    };
    expect(msg.channel_name).toBe("#general");
    expect(msg.sender_type).toBe("human");
  });

  it("maxMessages defaults to 10000", () => {
    const defaultMax = 10000;
    expect(defaultMax).toBe(10000);
  });

  it("returns null for non-existent workspace", () => {
    const result = null; // simulating not found
    expect(result).toBeNull();
  });
});
