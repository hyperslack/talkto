export type NotificationPrefs = {
  desktop: boolean;
  mentionsOnly: boolean;
  sound: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  desktop: true,
  mentionsOnly: false,
  sound: true,
};

/** Merge partial persisted prefs with defaults safely. */
export function mergeNotificationPrefs(
  partial: Partial<NotificationPrefs> | null | undefined,
): NotificationPrefs {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(partial ?? {}),
  };
}
