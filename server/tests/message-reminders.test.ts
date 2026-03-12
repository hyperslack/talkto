/**
 * Tests for message reminders service.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  createReminder,
  cancelReminder,
  listReminders,
  fireDueReminders,
  getReminder,
  pendingCount,
  clearAll,
} from "../src/services/message-reminders";

const USER = "user-1";

beforeEach(() => clearAll());

describe("createReminder", () => {
  it("creates a reminder with all fields", () => {
    const r = createReminder(USER, "msg-1", "ch-1", "2026-12-01T10:00:00Z", "check this");
    expect(r.userId).toBe(USER);
    expect(r.messageId).toBe("msg-1");
    expect(r.channelId).toBe("ch-1");
    expect(r.note).toBe("check this");
    expect(r.fired).toBe(false);
  });

  it("creates reminder without note", () => {
    const r = createReminder(USER, "msg-1", "ch-1", "2026-12-01T10:00:00Z");
    expect(r.note).toBeNull();
  });
});

describe("cancelReminder", () => {
  it("cancels own reminder", () => {
    const r = createReminder(USER, "msg-1", "ch-1", "2026-12-01T10:00:00Z");
    expect(cancelReminder(r.id, USER)).toBe(true);
    expect(getReminder(r.id)).toBeNull();
  });

  it("rejects cancellation by different user", () => {
    const r = createReminder(USER, "msg-1", "ch-1", "2026-12-01T10:00:00Z");
    expect(cancelReminder(r.id, "other-user")).toBe(false);
  });
});

describe("listReminders", () => {
  it("lists pending reminders sorted by time", () => {
    createReminder(USER, "m2", "ch-1", "2026-12-02T10:00:00Z");
    createReminder(USER, "m1", "ch-1", "2026-12-01T10:00:00Z");
    const list = listReminders(USER);
    expect(list.length).toBe(2);
    expect(list[0].messageId).toBe("m1"); // earlier first
  });

  it("excludes fired reminders", () => {
    const r = createReminder(USER, "m1", "ch-1", "2020-01-01T00:00:00Z");
    fireDueReminders(); // fires the past reminder
    expect(listReminders(USER).length).toBe(0);
  });
});

describe("fireDueReminders", () => {
  it("fires reminders with past remindAt", () => {
    createReminder(USER, "m1", "ch-1", "2020-01-01T00:00:00Z");
    createReminder(USER, "m2", "ch-1", "2099-01-01T00:00:00Z");
    const due = fireDueReminders();
    expect(due.length).toBe(1);
    expect(due[0].messageId).toBe("m1");
    expect(due[0].fired).toBe(true);
  });
});

describe("pendingCount", () => {
  it("counts unfired reminders", () => {
    createReminder(USER, "m1", "ch-1", "2099-01-01T00:00:00Z");
    createReminder(USER, "m2", "ch-1", "2099-01-02T00:00:00Z");
    expect(pendingCount(USER)).toBe(2);
  });
});
