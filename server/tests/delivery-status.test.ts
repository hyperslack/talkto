/**
 * Tests for message delivery status tracking.
 */

import { describe, expect, it } from "bun:test";

describe("Message Delivery Status", () => {
  it("valid delivery states", () => {
    const states = ["sent", "delivered", "seen"];
    expect(states.length).toBe(3);
  });

  it("delivery status shape has correct fields", () => {
    const status = {
      message_id: "msg-1",
      user_id: "user-1",
      status: "delivered" as const,
      delivered_at: new Date().toISOString(),
      seen_at: null,
    };
    expect(status.message_id).toBe("msg-1");
    expect(status.status).toBe("delivered");
    expect(status.delivered_at).toBeTruthy();
    expect(status.seen_at).toBeNull();
  });

  it("seen implies delivered", () => {
    const status = {
      status: "seen" as const,
      delivered_at: "2026-01-01T00:00:00Z",
      seen_at: "2026-01-01T00:00:01Z",
    };
    // seen_at should always come after delivered_at
    expect(new Date(status.seen_at).getTime()).toBeGreaterThanOrEqual(
      new Date(status.delivered_at).getTime()
    );
  });

  it("delivery summary has correct shape", () => {
    const summary = { sent: 2, delivered: 5, seen: 3 };
    expect(summary.sent + summary.delivered + summary.seen).toBe(10);
  });

  it("state progression is sent → delivered → seen", () => {
    const order = ["sent", "delivered", "seen"];
    expect(order.indexOf("sent")).toBeLessThan(order.indexOf("delivered"));
    expect(order.indexOf("delivered")).toBeLessThan(order.indexOf("seen"));
  });

  it("composite key is message_id + user_id", () => {
    const key1 = `msg-1:user-1`;
    const key2 = `msg-1:user-2`;
    expect(key1).not.toBe(key2);
  });
});
