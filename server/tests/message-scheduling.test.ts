import { describe, it, expect, beforeEach } from "vitest";
import { MessageSchedulingQueue } from "../src/utils/message-scheduling";

describe("MessageSchedulingQueue", () => {
  let queue: MessageSchedulingQueue;
  const future = new Date(Date.now() + 60_000).toISOString();
  const farFuture = new Date(Date.now() + 120_000).toISOString();

  beforeEach(() => {
    queue = new MessageSchedulingQueue();
  });

  it("schedules a message and returns it", () => {
    const msg = queue.schedule({ channelId: "c1", senderId: "u1", content: "hello", scheduledAt: future });
    expect(msg.id).toMatch(/^sched_/);
    expect(msg.status).toBe("pending");
    expect(msg.content).toBe("hello");
    expect(msg.channelId).toBe("c1");
  });

  it("rejects empty content", () => {
    expect(() => queue.schedule({ channelId: "c1", senderId: "u1", content: "  ", scheduledAt: future })).toThrow("Content cannot be empty");
  });

  it("rejects invalid date", () => {
    expect(() => queue.schedule({ channelId: "c1", senderId: "u1", content: "hi", scheduledAt: "not-a-date" })).toThrow("Invalid scheduledAt date");
  });

  it("rejects past scheduledAt", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(() => queue.schedule({ channelId: "c1", senderId: "u1", content: "hi", scheduledAt: past })).toThrow("scheduledAt must be in the future");
  });

  it("cancels a pending message", () => {
    const msg = queue.schedule({ channelId: "c1", senderId: "u1", content: "hi", scheduledAt: future });
    expect(queue.cancel(msg.id)).toBe(true);
    expect(queue.get(msg.id)?.status).toBe("cancelled");
  });

  it("cancel returns false for non-existent", () => {
    expect(queue.cancel("nope")).toBe(false);
  });

  it("cancel returns false for already cancelled", () => {
    const msg = queue.schedule({ channelId: "c1", senderId: "u1", content: "hi", scheduledAt: future });
    queue.cancel(msg.id);
    expect(queue.cancel(msg.id)).toBe(false);
  });

  it("lists pending messages for a channel", () => {
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: farFuture });
    queue.schedule({ channelId: "c1", senderId: "u1", content: "b", scheduledAt: future });
    queue.schedule({ channelId: "c2", senderId: "u1", content: "c", scheduledAt: future });
    const pending = queue.listPending("c1");
    expect(pending).toHaveLength(2);
    expect(pending[0].content).toBe("b"); // sorted by scheduledAt
  });

  it("lists all pending when no channelId", () => {
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: future });
    queue.schedule({ channelId: "c2", senderId: "u1", content: "b", scheduledAt: future });
    expect(queue.listPending()).toHaveLength(2);
  });

  it("lists messages by sender", () => {
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: future });
    queue.schedule({ channelId: "c1", senderId: "u2", content: "b", scheduledAt: future });
    expect(queue.listBySender("u1")).toHaveLength(1);
  });

  it("fires due messages", () => {
    const pastish = new Date(Date.now() + 1_000).toISOString();
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: pastish });
    queue.schedule({ channelId: "c1", senderId: "u1", content: "b", scheduledAt: farFuture });
    const fired = queue.fireDue(new Date(Date.now() + 5_000));
    expect(fired).toHaveLength(1);
    expect(fired[0].content).toBe("a");
    expect(fired[0].status).toBe("delivered");
  });

  it("pendingCount reflects queue state", () => {
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: future });
    queue.schedule({ channelId: "c1", senderId: "u1", content: "b", scheduledAt: future });
    expect(queue.pendingCount()).toBe(2);
    const msgs = queue.listPending();
    queue.cancel(msgs[0].id);
    expect(queue.pendingCount()).toBe(1);
  });

  it("purge removes cancelled and delivered", () => {
    const msg1 = queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: future });
    queue.schedule({ channelId: "c1", senderId: "u1", content: "b", scheduledAt: future });
    queue.cancel(msg1.id);
    expect(queue.purge()).toBe(1);
    expect(queue.pendingCount()).toBe(1);
  });

  it("trims content whitespace", () => {
    const msg = queue.schedule({ channelId: "c1", senderId: "u1", content: "  hello  ", scheduledAt: future });
    expect(msg.content).toBe("hello");
  });

  it("get returns undefined for non-existent", () => {
    expect(queue.get("nope")).toBeUndefined();
  });

  it("clear removes everything", () => {
    queue.schedule({ channelId: "c1", senderId: "u1", content: "a", scheduledAt: future });
    queue.clear();
    expect(queue.pendingCount()).toBe(0);
  });
});
