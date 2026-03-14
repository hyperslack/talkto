import { describe, expect, test } from "bun:test";
import {
  ChannelRoleStore,
  canPerform,
  userCanPerform,
  roleLabel,
} from "../src/utils/channel-moderators";

describe("ChannelRoleStore", () => {
  test("default role is member", () => {
    const store = new ChannelRoleStore();
    expect(store.getRole("ch1", "user1")).toBe("member");
  });

  test("set and get role", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "user1", "moderator", "admin");
    expect(store.getRole("ch1", "user1")).toBe("moderator");
  });

  test("set role returns entry", () => {
    const store = new ChannelRoleStore();
    const entry = store.setRole("ch1", "user1", "owner", "admin");
    expect(entry.userId).toBe("user1");
    expect(entry.channelId).toBe("ch1");
    expect(entry.role).toBe("owner");
    expect(entry.assignedBy).toBe("admin");
  });

  test("remove role reverts to member", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "user1", "moderator", "admin");
    expect(store.removeRole("ch1", "user1")).toBe(true);
    expect(store.getRole("ch1", "user1")).toBe("member");
  });

  test("remove nonexistent returns false", () => {
    const store = new ChannelRoleStore();
    expect(store.removeRole("ch1", "user1")).toBe(false);
  });

  test("listPrivileged returns owners and moderators", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "u1", "owner", "admin");
    store.setRole("ch1", "u2", "moderator", "admin");
    store.setRole("ch1", "u3", "member", "admin");
    const priv = store.listPrivileged("ch1");
    expect(priv.length).toBe(2);
  });

  test("listPrivileged returns empty for unknown channel", () => {
    const store = new ChannelRoleStore();
    expect(store.listPrivileged("unknown")).toEqual([]);
  });

  test("moderatorCount counts only moderators", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "u1", "owner", "admin");
    store.setRole("ch1", "u2", "moderator", "admin");
    store.setRole("ch1", "u3", "moderator", "admin");
    expect(store.moderatorCount("ch1")).toBe(2);
  });

  test("roles are scoped per channel", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "u1", "moderator", "admin");
    expect(store.getRole("ch1", "u1")).toBe("moderator");
    expect(store.getRole("ch2", "u1")).toBe("member");
  });
});

describe("canPerform", () => {
  test("owner can do everything", () => {
    expect(canPerform("owner", "pin_message")).toBe(true);
    expect(canPerform("owner", "kick_user")).toBe(true);
  });

  test("moderator can pin and delete but not kick", () => {
    expect(canPerform("moderator", "pin_message")).toBe(true);
    expect(canPerform("moderator", "delete_message")).toBe(true);
    expect(canPerform("moderator", "kick_user")).toBe(false);
  });

  test("member cannot do privileged actions", () => {
    expect(canPerform("member", "pin_message")).toBe(false);
    expect(canPerform("member", "delete_message")).toBe(false);
    expect(canPerform("member", "kick_user")).toBe(false);
  });
});

describe("userCanPerform", () => {
  test("checks role from store", () => {
    const store = new ChannelRoleStore();
    store.setRole("ch1", "u1", "moderator", "admin");
    expect(userCanPerform(store, "ch1", "u1", "pin_message")).toBe(true);
    expect(userCanPerform(store, "ch1", "u1", "kick_user")).toBe(false);
    expect(userCanPerform(store, "ch1", "u2", "pin_message")).toBe(false);
  });
});

describe("roleLabel", () => {
  test("returns formatted labels", () => {
    expect(roleLabel("owner")).toContain("Owner");
    expect(roleLabel("moderator")).toContain("Moderator");
    expect(roleLabel("member")).toBe("Member");
  });
});
