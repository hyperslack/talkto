import { describe, expect, test } from "bun:test";
import {
  computeNotifications,
  primaryReason,
  formatReason,
  shouldNotifyUser,
  type ThreadParticipant,
} from "../src/utils/thread-notifications";

function participant(overrides: Partial<ThreadParticipant> & { userId: string }): ThreadParticipant {
  return {
    name: overrides.name ?? overrides.userId,
    subscribed: null,
    hasPosted: false,
    isRootAuthor: false,
    ...overrides,
  };
}

describe("computeNotifications", () => {
  test("notifies root author on reply", () => {
    const participants = [
      participant({ userId: "author", isRootAuthor: true, hasPosted: true }),
      participant({ userId: "replier", hasPosted: true }),
    ];
    const result = computeNotifications(participants, [], "replier");
    expect(result.length).toBe(1);
    expect(result[0].userId).toBe("author");
    expect(result[0].reasons).toContain("root_author");
  });

  test("does not notify the sender", () => {
    const participants = [
      participant({ userId: "alice", isRootAuthor: true, hasPosted: true }),
    ];
    const result = computeNotifications(participants, [], "alice");
    expect(result.length).toBe(0);
  });

  test("notifies thread participants", () => {
    const participants = [
      participant({ userId: "author", isRootAuthor: true, hasPosted: true }),
      participant({ userId: "bob", hasPosted: true }),
      participant({ userId: "charlie", hasPosted: true }),
    ];
    const result = computeNotifications(participants, [], "charlie");
    expect(result.length).toBe(2);
    const bob = result.find((n) => n.userId === "bob");
    expect(bob?.reasons).toContain("participant");
  });

  test("respects explicit unsubscribe", () => {
    const participants = [
      participant({ userId: "author", isRootAuthor: true, hasPosted: true, subscribed: false }),
    ];
    const result = computeNotifications(participants, [], "replier");
    expect(result.length).toBe(0);
  });

  test("unsubscribed users still get notified when mentioned", () => {
    const participants = [
      participant({ userId: "author", isRootAuthor: true, subscribed: false }),
    ];
    const result = computeNotifications(participants, ["author"], "replier");
    expect(result.length).toBe(1);
    expect(result[0].reasons).toContain("mentioned");
  });

  test("notifies mentioned users not in participants", () => {
    const result = computeNotifications([], ["external-user"], "sender");
    expect(result.length).toBe(1);
    expect(result[0].userId).toBe("external-user");
    expect(result[0].reasons).toEqual(["mentioned"]);
  });

  test("subscribed users get notified even without posting", () => {
    const participants = [
      participant({ userId: "watcher", subscribed: true }),
    ];
    const result = computeNotifications(participants, [], "sender");
    expect(result.length).toBe(1);
    expect(result[0].reasons).toContain("subscribed");
  });

  test("combines multiple reasons", () => {
    const participants = [
      participant({ userId: "author", isRootAuthor: true, hasPosted: true, subscribed: true }),
    ];
    const result = computeNotifications(participants, ["author"], "sender");
    expect(result[0].reasons).toContain("root_author");
    expect(result[0].reasons).toContain("subscribed");
    expect(result[0].reasons).toContain("mentioned");
  });
});

describe("primaryReason", () => {
  test("mentioned takes highest priority", () => {
    expect(primaryReason(["participant", "mentioned", "root_author"])).toBe("mentioned");
  });

  test("root_author over participant", () => {
    expect(primaryReason(["participant", "root_author"])).toBe("root_author");
  });

  test("subscribed over participant", () => {
    expect(primaryReason(["participant", "subscribed"])).toBe("subscribed");
  });
});

describe("formatReason", () => {
  test("formats all reason types", () => {
    expect(formatReason("root_author")).toContain("your message");
    expect(formatReason("participant")).toContain("participated");
    expect(formatReason("mentioned")).toContain("mentioned");
    expect(formatReason("subscribed")).toContain("follow");
  });
});

describe("shouldNotifyUser", () => {
  test("none preference blocks all", () => {
    expect(shouldNotifyUser({ userId: "u", name: "u", reasons: ["mentioned"] }, "none")).toBe(false);
  });

  test("all preference allows everything", () => {
    expect(shouldNotifyUser({ userId: "u", name: "u", reasons: ["participant"] }, "all")).toBe(true);
  });

  test("mentions_only allows mentions and root_author", () => {
    expect(shouldNotifyUser({ userId: "u", name: "u", reasons: ["mentioned"] }, "mentions_only")).toBe(true);
    expect(shouldNotifyUser({ userId: "u", name: "u", reasons: ["root_author"] }, "mentions_only")).toBe(true);
    expect(shouldNotifyUser({ userId: "u", name: "u", reasons: ["participant"] }, "mentions_only")).toBe(false);
  });
});
