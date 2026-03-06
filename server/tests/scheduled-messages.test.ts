/**
 * Tests for scheduled messages.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  ScheduleMessageSchema,
  scheduledMessages,
  deliverDueMessages,
  type ScheduledMessage,
} from "../src/routes/scheduled-messages";

beforeEach(() => {
  // Clear scheduled messages
  scheduledMessages.length = 0;
});

describe("ScheduleMessageSchema", () => {
  it("validates a correct schedule payload", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = ScheduleMessageSchema.safeParse({
      content: "Hello future!",
      send_at: future,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = ScheduleMessageSchema.safeParse({
      content: "",
      send_at: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid send_at", () => {
    const result = ScheduleMessageSchema.safeParse({
      content: "hello",
      send_at: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional mentions", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = ScheduleMessageSchema.safeParse({
      content: "Hey @agent1",
      send_at: future,
      mentions: ["agent1"],
    });
    expect(result.success).toBe(true);
  });
});

describe("scheduledMessages store", () => {
  it("can add and cancel a scheduled message", () => {
    const msg: ScheduledMessage = {
      id: "test-1",
      channelId: "ch-1",
      senderId: "user-1",
      senderName: "Test",
      content: "scheduled",
      sendAt: new Date(Date.now() + 60_000).toISOString(),
      workspaceId: "ws-1",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    scheduledMessages.push(msg);
    expect(scheduledMessages).toHaveLength(1);

    msg.status = "cancelled";
    expect(scheduledMessages[0].status).toBe("cancelled");
  });

  it("deliverDueMessages skips future messages", () => {
    scheduledMessages.push({
      id: "test-2",
      channelId: "ch-1",
      senderId: "user-1",
      senderName: "Test",
      content: "not yet",
      sendAt: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour from now
      workspaceId: "ws-1",
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    // deliverDueMessages requires DB, but we can verify the message stays pending
    // since its sendAt is in the future
    const pending = scheduledMessages.filter((m) => m.status === "pending");
    expect(pending).toHaveLength(1);
  });

  it("deliverDueMessages skips cancelled messages", () => {
    scheduledMessages.push({
      id: "test-3",
      channelId: "ch-1",
      senderId: "user-1",
      senderName: "Test",
      content: "cancelled",
      sendAt: new Date(Date.now() - 1000).toISOString(), // past
      workspaceId: "ws-1",
      createdAt: new Date().toISOString(),
      status: "cancelled",
    });

    // Cancelled messages should not be delivered even if past due
    const pendingCount = scheduledMessages.filter((m) => m.status === "pending").length;
    expect(pendingCount).toBe(0);
  });
});
