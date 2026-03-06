/**
 * Tests for workspace broadcast endpoint.
 */

import { describe, expect, it } from "bun:test";
import { BroadcastSchema } from "../src/routes/broadcast";

describe("BroadcastSchema", () => {
  it("validates a valid broadcast", () => {
    const result = BroadcastSchema.safeParse({ content: "📢 Important announcement!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = BroadcastSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional channel_types filter", () => {
    const result = BroadcastSchema.safeParse({
      content: "Hello",
      channel_types: ["general", "custom"],
    });
    expect(result.success).toBe(true);
    expect(result.data!.channel_types).toEqual(["general", "custom"]);
  });

  it("rejects content over 32000 chars", () => {
    const result = BroadcastSchema.safeParse({ content: "x".repeat(32001) });
    expect(result.success).toBe(false);
  });
});
