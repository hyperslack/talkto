import { describe, test, expect } from "bun:test";
import {
  NotificationSoundStore,
  isValidSound,
  isValidNotificationType,
  getNotificationTypes,
  getSoundOptions,
} from "../src/lib/notification-sounds";

describe("NotificationSoundStore", () => {
  test("creates default preferences for new user", () => {
    const store = new NotificationSoundStore();
    const prefs = store.get("user1");
    expect(prefs.globalMute).toBe(false);
    expect(prefs.preferences.size).toBe(5);
    expect(prefs.preferences.get("mention")!.sound).toBe("default");
  });

  test("sets sound for notification type", () => {
    const store = new NotificationSoundStore();
    const pref = store.set("user1", "mention", "chime", 0.8);
    expect(pref.sound).toBe("chime");
    expect(pref.volume).toBe(0.8);
  });

  test("handles custom sound with URL", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "dm", "custom", 1.0, "https://example.com/sound.mp3");
    const resolved = store.resolveSound("user1", "dm");
    expect(resolved!.sound).toBe("custom");
    expect(resolved!.customUrl).toBe("https://example.com/sound.mp3");
  });

  test("clamps volume to 0-1 range", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "mention", "ding", 5.0);
    const pref = store.get("user1").preferences.get("mention")!;
    expect(pref.volume).toBe(1.0);
  });

  test("shouldPlaySound returns false when muted", () => {
    const store = new NotificationSoundStore();
    store.setMute("user1", true);
    expect(store.shouldPlaySound("user1", "mention")).toBe(false);
  });

  test("shouldPlaySound returns false for silent sound", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "channel_message", "silent");
    expect(store.shouldPlaySound("user1", "channel_message")).toBe(false);
  });

  test("shouldPlaySound returns true by default", () => {
    const store = new NotificationSoundStore();
    expect(store.shouldPlaySound("user1", "mention")).toBe(true);
  });

  test("resolveSound returns null when muted", () => {
    const store = new NotificationSoundStore();
    store.setMute("user1", true);
    expect(store.resolveSound("user1", "dm")).toBeNull();
  });

  test("resolveSound returns configured sound", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "thread_reply", "pop", 0.5);
    const resolved = store.resolveSound("user1", "thread_reply");
    expect(resolved!.sound).toBe("pop");
    expect(resolved!.volume).toBe(0.5);
  });

  test("reset restores defaults", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "mention", "silent");
    store.setMute("user1", true);
    store.reset("user1");
    expect(store.get("user1").globalMute).toBe(false);
    expect(store.get("user1").preferences.get("mention")!.sound).toBe("default");
  });

  test("toJSON serializes correctly", () => {
    const store = new NotificationSoundStore();
    store.set("user1", "dm", "chime", 0.7);
    const json = store.toJSON("user1");
    expect(json.userId).toBe("user1");
    expect(json.globalMute).toBe(false);
    expect((json.preferences as any).dm.sound).toBe("chime");
  });
});

describe("validation helpers", () => {
  test("isValidSound validates correctly", () => {
    expect(isValidSound("default")).toBe(true);
    expect(isValidSound("chime")).toBe(true);
    expect(isValidSound("invalid")).toBe(false);
  });

  test("isValidNotificationType validates correctly", () => {
    expect(isValidNotificationType("mention")).toBe(true);
    expect(isValidNotificationType("invalid")).toBe(false);
  });

  test("getNotificationTypes returns all types", () => {
    expect(getNotificationTypes()).toHaveLength(5);
  });

  test("getSoundOptions returns all options", () => {
    expect(getSoundOptions()).toHaveLength(6);
  });
});
