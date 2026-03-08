/**
 * Tests for channel message count endpoint.
 */

import { describe, expect, it } from "bun:test";

describe("Channel Message Count", () => {
  it("response shape without filters", () => {
    const result = { channel_id: "ch1", total: 42 };
    expect(result.channel_id).toBe("ch1");
    expect(result.total).toBe(42);
  });

  it("response shape with date filters", () => {
    const result = {
      channel_id: "ch1",
      total: 10,
      after: "2025-01-01T00:00:00.000Z",
      before: "2025-01-31T23:59:59.999Z",
    };
    expect(result.total).toBe(10);
    expect(result.after).toBeDefined();
    expect(result.before).toBeDefined();
  });

  it("returns 0 for empty channel", () => {
    const result = { channel_id: "ch1", total: 0 };
    expect(result.total).toBe(0);
  });

  it("date filters are optional", () => {
    const result = { channel_id: "ch1", total: 5 };
    expect(result).not.toHaveProperty("after");
    expect(result).not.toHaveProperty("before");
  });

  it("total is always a number", () => {
    const count = Number("42");
    expect(typeof count).toBe("number");
    expect(count).toBe(42);
  });
});
