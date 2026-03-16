/**
 * Notification sound preferences — per-user sound configuration
 * for different notification types.
 */

export type NotificationType = "mention" | "dm" | "thread_reply" | "channel_message" | "system";
export type SoundOption = "default" | "chime" | "ding" | "pop" | "silent" | "custom";

export interface SoundPreference {
  type: NotificationType;
  sound: SoundOption;
  volume: number; // 0.0 to 1.0
  customUrl?: string; // only when sound === "custom"
}

export interface UserSoundPrefs {
  userId: string;
  globalMute: boolean;
  preferences: Map<NotificationType, SoundPreference>;
}

const ALL_TYPES: NotificationType[] = ["mention", "dm", "thread_reply", "channel_message", "system"];
const VALID_SOUNDS: SoundOption[] = ["default", "chime", "ding", "pop", "silent", "custom"];

/**
 * In-memory store for user notification sound preferences.
 */
export class NotificationSoundStore {
  private store = new Map<string, UserSoundPrefs>();

  /**
   * Get preferences for a user, creating defaults if needed.
   */
  get(userId: string): UserSoundPrefs {
    if (!this.store.has(userId)) {
      this.store.set(userId, createDefaults(userId));
    }
    return this.store.get(userId)!;
  }

  /**
   * Set sound preference for a specific notification type.
   */
  set(userId: string, type: NotificationType, sound: SoundOption, volume?: number, customUrl?: string): SoundPreference {
    const prefs = this.get(userId);
    const pref: SoundPreference = {
      type,
      sound,
      volume: clampVolume(volume ?? 1.0),
      customUrl: sound === "custom" ? customUrl : undefined,
    };
    prefs.preferences.set(type, pref);
    return pref;
  }

  /**
   * Toggle global mute for a user.
   */
  setMute(userId: string, muted: boolean): void {
    this.get(userId).globalMute = muted;
  }

  /**
   * Check if a notification should play sound.
   */
  shouldPlaySound(userId: string, type: NotificationType): boolean {
    const prefs = this.get(userId);
    if (prefs.globalMute) return false;
    const pref = prefs.preferences.get(type);
    if (!pref) return true; // default: play
    return pref.sound !== "silent";
  }

  /**
   * Get the resolved sound for a notification type.
   */
  resolveSound(userId: string, type: NotificationType): { sound: SoundOption; volume: number; customUrl?: string } | null {
    if (!this.shouldPlaySound(userId, type)) return null;
    const pref = this.get(userId).preferences.get(type);
    if (!pref) return { sound: "default", volume: 1.0 };
    return { sound: pref.sound, volume: pref.volume, customUrl: pref.customUrl };
  }

  /**
   * Reset a user's preferences to defaults.
   */
  reset(userId: string): void {
    this.store.set(userId, createDefaults(userId));
  }

  /**
   * Serialize preferences for API response.
   */
  toJSON(userId: string): Record<string, unknown> {
    const prefs = this.get(userId);
    const preferences: Record<string, unknown> = {};
    for (const [type, pref] of prefs.preferences) {
      preferences[type] = { sound: pref.sound, volume: pref.volume, customUrl: pref.customUrl };
    }
    return { userId, globalMute: prefs.globalMute, preferences };
  }
}

function createDefaults(userId: string): UserSoundPrefs {
  const preferences = new Map<NotificationType, SoundPreference>();
  for (const type of ALL_TYPES) {
    preferences.set(type, { type, sound: "default", volume: 1.0 });
  }
  return { userId, globalMute: false, preferences };
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Validate a sound option string.
 */
export function isValidSound(sound: string): sound is SoundOption {
  return VALID_SOUNDS.includes(sound as SoundOption);
}

/**
 * Validate a notification type string.
 */
export function isValidNotificationType(type: string): type is NotificationType {
  return ALL_TYPES.includes(type as NotificationType);
}

/**
 * Get all available notification types.
 */
export function getNotificationTypes(): NotificationType[] {
  return [...ALL_TYPES];
}

/**
 * Get all available sound options.
 */
export function getSoundOptions(): SoundOption[] {
  return [...VALID_SOUNDS];
}
