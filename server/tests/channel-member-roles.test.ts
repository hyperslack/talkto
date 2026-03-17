import { describe, it, expect, beforeEach } from "vitest";
import { ChannelMemberRoleStore } from "../src/utils/channel-member-roles";

describe("ChannelMemberRoleStore", () => {
  let store: ChannelMemberRoleStore;

  beforeEach(() => {
    store = new ChannelMemberRoleStore();
  });

  it("defaults to member role", () => {
    expect(store.getRole("c1", "u1")).toBe("member");
  });

  it("assigns a role", () => {
    const entry = store.assign("c1", "u1", "moderator", "admin1");
    expect(entry.role).toBe("moderator");
    expect(entry.assignedBy).toBe("admin1");
    expect(store.getRole("c1", "u1")).toBe("moderator");
  });

  it("overwrites existing role", () => {
    store.assign("c1", "u1", "moderator", "admin1");
    store.assign("c1", "u1", "owner", "admin1");
    expect(store.getRole("c1", "u1")).toBe("owner");
  });

  it("removes a role", () => {
    store.assign("c1", "u1", "moderator", "admin1");
    expect(store.remove("c1", "u1")).toBe(true);
    expect(store.getRole("c1", "u1")).toBe("member");
  });

  it("remove returns false for non-existent", () => {
    expect(store.remove("c1", "u1")).toBe(false);
  });

  it("owner has all permissions", () => {
    store.assign("c1", "u1", "owner", "system");
    expect(store.hasPermission("c1", "u1", "delete_message")).toBe(true);
    expect(store.hasPermission("c1", "u1", "manage_roles")).toBe(true);
    expect(store.hasPermission("c1", "u1", "kick_member")).toBe(true);
  });

  it("moderator has limited permissions", () => {
    store.assign("c1", "u1", "moderator", "system");
    expect(store.hasPermission("c1", "u1", "delete_message")).toBe(true);
    expect(store.hasPermission("c1", "u1", "pin_message")).toBe(true);
    expect(store.hasPermission("c1", "u1", "manage_roles")).toBe(false);
    expect(store.hasPermission("c1", "u1", "kick_member")).toBe(false);
  });

  it("member has no permissions", () => {
    expect(store.hasPermission("c1", "u1", "delete_message")).toBe(false);
  });

  it("lists by channel sorted by hierarchy", () => {
    store.assign("c1", "u1", "member", "admin");
    store.assign("c1", "u2", "owner", "admin");
    store.assign("c1", "u3", "moderator", "admin");
    const list = store.listByChannel("c1");
    expect(list).toHaveLength(3);
    expect(list[0].role).toBe("owner");
    expect(list[1].role).toBe("moderator");
    expect(list[2].role).toBe("member");
  });

  it("lists by user", () => {
    store.assign("c1", "u1", "owner", "admin");
    store.assign("c2", "u1", "moderator", "admin");
    store.assign("c1", "u2", "member", "admin");
    expect(store.listByUser("u1")).toHaveLength(2);
  });

  it("outranks compares roles correctly", () => {
    expect(store.outranks("owner", "moderator")).toBe(true);
    expect(store.outranks("moderator", "member")).toBe(true);
    expect(store.outranks("member", "owner")).toBe(false);
    expect(store.outranks("owner", "owner")).toBe(false);
  });

  it("getPermissions returns correct set", () => {
    const perms = store.getPermissions("moderator");
    expect(perms).toContain("delete_message");
    expect(perms).not.toContain("manage_roles");
  });

  it("countByRole returns correct counts", () => {
    store.assign("c1", "u1", "owner", "admin");
    store.assign("c1", "u2", "moderator", "admin");
    store.assign("c1", "u3", "moderator", "admin");
    const counts = store.countByRole("c1");
    expect(counts.owner).toBe(1);
    expect(counts.moderator).toBe(2);
    expect(counts.member).toBe(0);
  });

  it("clear removes everything", () => {
    store.assign("c1", "u1", "owner", "admin");
    store.clear();
    expect(store.getRole("c1", "u1")).toBe("member");
  });
});
