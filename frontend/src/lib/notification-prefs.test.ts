import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  mergeNotificationPrefs,
} from "./notification-prefs";

describe("mergeNotificationPrefs", () => {
  it("returns defaults for nullish input", () => {
    expect(mergeNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(mergeNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("overrides only provided fields", () => {
    expect(mergeNotificationPrefs({ mentionsOnly: true })).toEqual({
      desktop: true,
      mentionsOnly: true,
      sound: true,
    });
  });
});
