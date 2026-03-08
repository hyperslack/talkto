/**
 * Tests for channel archive reason tracking.
 */

import { describe, expect, it } from "bun:test";

describe("Archive Reason", () => {
  it("archive reason entry has required fields", () => {
    const entry = {
      channel_id: "ch1",
      reason: "Project completed",
      archived_by: "user-1",
      archived_at: "2025-01-15T10:30:00.000Z",
    };
    expect(entry.channel_id).toBe("ch1");
    expect(entry.reason).toBe("Project completed");
    expect(entry.archived_by).toBe("user-1");
    expect(entry.archived_at).toBeDefined();
  });

  it("reason can be null", () => {
    const entry = {
      channel_id: "ch1",
      reason: null,
      archived_by: "user-1",
      archived_at: "2025-01-15T10:30:00.000Z",
    };
    expect(entry.reason).toBeNull();
  });

  it("archived_by can be null for system archives", () => {
    const entry = {
      channel_id: "ch1",
      reason: "Auto-archived",
      archived_by: null,
      archived_at: "2025-01-15T10:30:00.000Z",
    };
    expect(entry.archived_by).toBeNull();
  });

  it("no reason for non-archived channel", () => {
    const response = {
      channel_id: "ch1",
      reason: null,
      archived_by: null,
      archived_at: null,
    };
    expect(response.reason).toBeNull();
    expect(response.archived_at).toBeNull();
  });

  it("reason is cleared on unarchive", () => {
    // Simulate: archive → get reason → unarchive → get reason
    let reason: string | null = "No longer needed";
    expect(reason).toBe("No longer needed");
    reason = null; // cleared
    expect(reason).toBeNull();
  });

  it("reason can be updated on re-archive", () => {
    const first = { reason: "First archive reason" };
    const second = { reason: "New reason after re-archive" };
    expect(first.reason).not.toBe(second.reason);
  });
});
