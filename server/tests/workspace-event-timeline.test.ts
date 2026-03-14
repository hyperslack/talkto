import { describe, expect, test } from "bun:test";
import {
  EventTimeline,
  eventIcon,
  formatEvent,
  type TimelineEvent,
} from "../src/utils/workspace-event-timeline";

const NOW = 1700000000000;

function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? "e1",
    kind: overrides.kind ?? "message",
    timestamp: overrides.timestamp ?? NOW,
    actorName: overrides.actorName ?? "alice",
    actorType: overrides.actorType ?? "human",
    channelId: overrides.channelId,
    channelName: overrides.channelName ?? "general",
    detail: overrides.detail,
  };
}

describe("EventTimeline", () => {
  test("push and retrieve events", () => {
    const tl = new EventTimeline();
    tl.push(event({ id: "e1" }));
    tl.push(event({ id: "e2" }));
    expect(tl.size).toBe(2);
  });

  test("recent returns newest first", () => {
    const tl = new EventTimeline();
    tl.push(event({ id: "e1", timestamp: NOW }));
    tl.push(event({ id: "e2", timestamp: NOW + 1000 }));
    const recent = tl.recent();
    expect(recent[0].id).toBe("e2");
    expect(recent[1].id).toBe("e1");
  });

  test("recent respects limit", () => {
    const tl = new EventTimeline();
    for (let i = 0; i < 10; i++) tl.push(event({ id: `e${i}` }));
    expect(tl.recent({ limit: 3 }).length).toBe(3);
  });

  test("recent filters by kind", () => {
    const tl = new EventTimeline();
    tl.push(event({ id: "e1", kind: "message" }));
    tl.push(event({ id: "e2", kind: "member_joined" }));
    tl.push(event({ id: "e3", kind: "message" }));
    const msgs = tl.recent({ kinds: ["message"] });
    expect(msgs.length).toBe(2);
  });

  test("recent filters by channelId", () => {
    const tl = new EventTimeline();
    tl.push(event({ id: "e1", channelId: "ch1" }));
    tl.push(event({ id: "e2", channelId: "ch2" }));
    const filtered = tl.recent({ channelId: "ch1" });
    expect(filtered.length).toBe(1);
  });

  test("recent filters by since", () => {
    const tl = new EventTimeline();
    tl.push(event({ id: "e1", timestamp: NOW - 10_000 }));
    tl.push(event({ id: "e2", timestamp: NOW }));
    const filtered = tl.recent({ since: NOW - 5000 });
    expect(filtered.length).toBe(1);
  });

  test("respects maxSize capacity", () => {
    const tl = new EventTimeline(5);
    for (let i = 0; i < 10; i++) tl.push(event({ id: `e${i}`, timestamp: NOW + i }));
    expect(tl.size).toBe(5);
    // Should keep the most recent
    const recent = tl.recent();
    expect(recent[0].id).toBe("e9");
  });

  test("countByKind groups within window", () => {
    const tl = new EventTimeline();
    tl.push(event({ kind: "message", timestamp: NOW }));
    tl.push(event({ kind: "message", timestamp: NOW + 1000 }));
    tl.push(event({ kind: "member_joined", timestamp: NOW + 2000 }));
    tl.push(event({ kind: "message", timestamp: NOW - 100_000 })); // old

    const counts = tl.countByKind(10_000, NOW + 3000);
    expect(counts["message"]).toBe(2);
    expect(counts["member_joined"]).toBe(1);
  });

  test("clear removes all events", () => {
    const tl = new EventTimeline();
    tl.push(event());
    tl.clear();
    expect(tl.size).toBe(0);
  });
});

describe("eventIcon", () => {
  test("returns emoji for each kind", () => {
    expect(eventIcon("message")).toBe("💬");
    expect(eventIcon("member_joined")).toBe("👋");
    expect(eventIcon("agent_online")).toBe("🤖");
    expect(eventIcon("pin")).toBe("📌");
  });
});

describe("formatEvent", () => {
  test("formats message event", () => {
    const e = event({ kind: "message", actorName: "alice", channelName: "dev", detail: "hello" });
    expect(formatEvent(e)).toContain("alice");
    expect(formatEvent(e)).toContain("#dev");
    expect(formatEvent(e)).toContain("hello");
  });

  test("formats channel_created event", () => {
    const e = event({ kind: "channel_created", actorName: "bob", channelName: "new-proj" });
    expect(formatEvent(e)).toContain("bob");
    expect(formatEvent(e)).toContain("created");
    expect(formatEvent(e)).toContain("#new-proj");
  });

  test("formats member_joined event", () => {
    const e = event({ kind: "member_joined", actorName: "charlie" });
    expect(formatEvent(e)).toContain("charlie");
    expect(formatEvent(e)).toContain("joined");
  });

  test("formats agent_online event", () => {
    const e = event({ kind: "agent_online", actorName: "claude" });
    expect(formatEvent(e)).toContain("claude");
    expect(formatEvent(e)).toContain("online");
  });
});
