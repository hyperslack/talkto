import { describe, expect, test } from "bun:test";
import {
  createStore,
  addAnnouncement,
  removeAnnouncement,
  isExpired,
  dismiss,
  isDismissed,
  getActiveAnnouncements,
  purgeExpired,
  levelBadge,
  type Announcement,
} from "../src/utils/workspace-announcement";

const NOW = 1700000000000;

function makeAnn(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: overrides.id ?? "ann-1",
    text: overrides.text ?? "Hello workspace",
    level: overrides.level ?? "info",
    createdBy: overrides.createdBy ?? "admin",
    createdAt: overrides.createdAt ?? NOW,
    expiresAt: overrides.expiresAt ?? null,
    dismissible: overrides.dismissible ?? true,
  };
}

describe("createStore", () => {
  test("creates empty store", () => {
    const store = createStore();
    expect(store.announcements.size).toBe(0);
    expect(store.dismissals.size).toBe(0);
  });
});

describe("addAnnouncement / removeAnnouncement", () => {
  test("adds and retrieves announcement", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn());
    expect(store.announcements.size).toBe(1);
  });

  test("removes announcement and its dismissals", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn());
    dismiss(store, "ann-1", "user-1");
    expect(removeAnnouncement(store, "ann-1")).toBe(true);
    expect(store.announcements.size).toBe(0);
    expect(store.dismissals.size).toBe(0);
  });

  test("returns false when removing nonexistent", () => {
    const store = createStore();
    expect(removeAnnouncement(store, "nope")).toBe(false);
  });
});

describe("isExpired", () => {
  test("not expired when expiresAt is null", () => {
    expect(isExpired(makeAnn({ expiresAt: null }), NOW)).toBe(false);
  });

  test("not expired when before expiresAt", () => {
    expect(isExpired(makeAnn({ expiresAt: NOW + 1000 }), NOW)).toBe(false);
  });

  test("expired when at or past expiresAt", () => {
    expect(isExpired(makeAnn({ expiresAt: NOW }), NOW)).toBe(true);
    expect(isExpired(makeAnn({ expiresAt: NOW - 1000 }), NOW)).toBe(true);
  });
});

describe("dismiss / isDismissed", () => {
  test("dismisses for a user", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn());
    expect(dismiss(store, "ann-1", "user-1")).toBe(true);
    expect(isDismissed(store, "ann-1", "user-1")).toBe(true);
    expect(isDismissed(store, "ann-1", "user-2")).toBe(false);
  });

  test("cannot dismiss non-dismissible announcement", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn({ dismissible: false }));
    expect(dismiss(store, "ann-1", "user-1")).toBe(false);
  });

  test("cannot dismiss nonexistent announcement", () => {
    const store = createStore();
    expect(dismiss(store, "nope", "user-1")).toBe(false);
  });
});

describe("getActiveAnnouncements", () => {
  test("returns non-expired, non-dismissed announcements", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn({ id: "a1" }));
    addAnnouncement(store, makeAnn({ id: "a2", expiresAt: NOW - 1 })); // expired
    addAnnouncement(store, makeAnn({ id: "a3" }));
    dismiss(store, "a3", "user-1");

    const active = getActiveAnnouncements(store, "user-1", NOW);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe("a1");
  });

  test("sorts by priority then recency", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn({ id: "a1", level: "info", createdAt: NOW }));
    addAnnouncement(store, makeAnn({ id: "a2", level: "critical", createdAt: NOW - 1000 }));
    addAnnouncement(store, makeAnn({ id: "a3", level: "warning", createdAt: NOW + 1000 }));

    const active = getActiveAnnouncements(store, "user-1", NOW + 5000);
    expect(active[0].id).toBe("a2"); // critical first
    expect(active[1].id).toBe("a3"); // warning
    expect(active[2].id).toBe("a1"); // info
  });
});

describe("purgeExpired", () => {
  test("removes expired announcements", () => {
    const store = createStore();
    addAnnouncement(store, makeAnn({ id: "a1", expiresAt: NOW - 1 }));
    addAnnouncement(store, makeAnn({ id: "a2", expiresAt: null }));
    addAnnouncement(store, makeAnn({ id: "a3", expiresAt: NOW + 1000 }));

    const purged = purgeExpired(store, NOW);
    expect(purged).toBe(1);
    expect(store.announcements.size).toBe(2);
  });
});

describe("levelBadge", () => {
  test("returns correct emoji for each level", () => {
    expect(levelBadge("critical")).toBe("🔴");
    expect(levelBadge("warning")).toBe("🟡");
    expect(levelBadge("info")).toBe("🔵");
  });
});
