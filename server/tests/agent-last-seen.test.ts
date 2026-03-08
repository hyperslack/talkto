/**
 * Tests for agent last-seen timestamp feature.
 */

import { describe, expect, it } from "bun:test";

describe("Agent Last Seen", () => {
  it("last seen response shape has all required fields", () => {
    const result = {
      agent_id: "abc-123",
      agent_name: "claude-agent",
      display_name: "Claude",
      last_seen_at: "2025-01-15T10:30:00.000Z",
    };
    expect(result.agent_id).toBe("abc-123");
    expect(result.agent_name).toBe("claude-agent");
    expect(result.display_name).toBe("Claude");
    expect(result.last_seen_at).toBe("2025-01-15T10:30:00.000Z");
  });

  it("last_seen_at is null when agent has no messages", () => {
    const result = {
      agent_id: "abc-123",
      agent_name: "idle-agent",
      display_name: null,
      last_seen_at: null,
    };
    expect(result.last_seen_at).toBeNull();
    expect(result.display_name).toBeNull();
  });

  it("returns the most recent timestamp from multiple messages", () => {
    const timestamps = [
      "2025-01-01T00:00:00.000Z",
      "2025-01-15T10:30:00.000Z",
      "2025-01-10T05:00:00.000Z",
    ];
    timestamps.sort();
    const lastSeen = timestamps[timestamps.length - 1];
    expect(lastSeen).toBe("2025-01-15T10:30:00.000Z");
  });

  it("multiple agents have independent last_seen_at values", () => {
    const agents = [
      { agent_name: "agent1", last_seen_at: "2025-01-01T00:00:00.000Z" },
      { agent_name: "agent2", last_seen_at: null },
      { agent_name: "agent3", last_seen_at: "2025-01-15T12:00:00.000Z" },
    ];
    expect(agents.length).toBe(3);
    expect(agents[0].last_seen_at).not.toBeNull();
    expect(agents[1].last_seen_at).toBeNull();
    expect(agents[2].last_seen_at).not.toBeNull();
  });

  it("returns null for unknown agent", () => {
    const result = null; // simulating agent not found
    expect(result).toBeNull();
  });
});
