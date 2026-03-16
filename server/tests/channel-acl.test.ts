import { describe, test, expect } from "bun:test";
import {
  ChannelAclStore,
  isValidPermission,
  getAllPermissions,
  formatAclEntry,
} from "../src/lib/channel-acl";

describe("ChannelAclStore", () => {
  test("sets and checks permission", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "write", action: "deny", grantedBy: "admin" });
    expect(store.check("ch1", "u1", "write")).toBe(false);
  });

  test("returns null for unset permission", () => {
    const store = new ChannelAclStore();
    expect(store.check("ch1", "u1", "read")).toBeNull();
  });

  test("isAllowed uses default when no rule exists", () => {
    const store = new ChannelAclStore();
    expect(store.isAllowed("ch1", "u1", "read", true)).toBe(true);
    expect(store.isAllowed("ch1", "u1", "read", false)).toBe(false);
  });

  test("isAllowed respects explicit rule over default", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "write", action: "deny", grantedBy: "admin" });
    expect(store.isAllowed("ch1", "u1", "write", true)).toBe(false);
  });

  test("overwrites existing entry for same subject+permission", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "write", action: "deny", grantedBy: "admin" });
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "write", action: "allow", grantedBy: "admin" });
    expect(store.check("ch1", "u1", "write")).toBe(true);
    expect(store.size()).toBe(1);
  });

  test("removes specific entry", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "read", action: "allow", grantedBy: "admin" });
    expect(store.remove("ch1", "u1", "read")).toBe(true);
    expect(store.check("ch1", "u1", "read")).toBeNull();
  });

  test("remove returns false when nothing to remove", () => {
    const store = new ChannelAclStore();
    expect(store.remove("ch1", "u1", "read")).toBe(false);
  });

  test("getChannelAcl returns all entries for channel", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "read", action: "allow", grantedBy: "admin" });
    store.set({ channelId: "ch1", subjectId: "u2", subjectType: "user", permission: "write", action: "deny", grantedBy: "admin" });
    store.set({ channelId: "ch2", subjectId: "u1", subjectType: "user", permission: "read", action: "allow", grantedBy: "admin" });
    expect(store.getChannelAcl("ch1")).toHaveLength(2);
  });

  test("getEffectivePermissions returns all permissions", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "write", action: "deny", grantedBy: "admin" });
    const perms = store.getEffectivePermissions("ch1", "u1");
    expect(perms.write).toBe("deny");
    expect(perms.read).toBe("default");
    expect(perms.manage).toBe("default");
  });

  test("clearChannel removes all entries for that channel", () => {
    const store = new ChannelAclStore();
    store.set({ channelId: "ch1", subjectId: "u1", subjectType: "user", permission: "read", action: "allow", grantedBy: "admin" });
    store.set({ channelId: "ch1", subjectId: "u2", subjectType: "user", permission: "write", action: "allow", grantedBy: "admin" });
    store.set({ channelId: "ch2", subjectId: "u1", subjectType: "user", permission: "read", action: "allow", grantedBy: "admin" });
    const removed = store.clearChannel("ch1");
    expect(removed).toBe(2);
    expect(store.size()).toBe(1);
  });
});

describe("helpers", () => {
  test("isValidPermission validates correctly", () => {
    expect(isValidPermission("read")).toBe(true);
    expect(isValidPermission("write")).toBe(true);
    expect(isValidPermission("invalid")).toBe(false);
  });

  test("getAllPermissions returns 5 permissions", () => {
    expect(getAllPermissions()).toHaveLength(5);
  });

  test("formatAclEntry formats allow entry", () => {
    const entry = {
      channelId: "ch1", subjectId: "u1", subjectType: "user" as const,
      permission: "write" as const, action: "allow" as const,
      grantedBy: "admin", grantedAt: new Date().toISOString(),
    };
    expect(formatAclEntry(entry)).toContain("✅");
  });

  test("formatAclEntry formats deny entry", () => {
    const entry = {
      channelId: "ch1", subjectId: "u1", subjectType: "user" as const,
      permission: "write" as const, action: "deny" as const,
      grantedBy: "admin", grantedAt: new Date().toISOString(),
    };
    expect(formatAclEntry(entry)).toContain("🚫");
  });
});
