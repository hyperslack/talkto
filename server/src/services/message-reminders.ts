/**
 * Message reminders — "snooze" / "remind me later" for messages.
 *
 * In-memory store. Provides scheduling, listing, and firing logic.
 */

export interface Reminder {
  id: string;
  userId: string;
  messageId: string;
  channelId: string;
  remindAt: string; // ISO 8601
  note: string | null;
  createdAt: string;
  fired: boolean;
}

const store = new Map<string, Reminder>();

/** Create a reminder for a message. */
export function createReminder(
  userId: string,
  messageId: string,
  channelId: string,
  remindAt: string,
  note: string | null = null,
): Reminder {
  const reminder: Reminder = {
    id: crypto.randomUUID(),
    userId,
    messageId,
    channelId,
    remindAt,
    note,
    createdAt: new Date().toISOString(),
    fired: false,
  };
  store.set(reminder.id, reminder);
  return reminder;
}

/** Cancel a reminder. Returns true if it existed. */
export function cancelReminder(reminderId: string, userId: string): boolean {
  const r = store.get(reminderId);
  if (!r || r.userId !== userId) return false;
  return store.delete(reminderId);
}

/** List pending (unfired) reminders for a user. */
export function listReminders(userId: string): Reminder[] {
  const result: Reminder[] = [];
  for (const r of store.values()) {
    if (r.userId === userId && !r.fired) {
      result.push(r);
    }
  }
  return result.sort((a, b) => a.remindAt.localeCompare(b.remindAt));
}

/** Get all reminders that should fire now. Marks them as fired. */
export function fireDueReminders(): Reminder[] {
  const now = new Date().toISOString();
  const due: Reminder[] = [];
  for (const r of store.values()) {
    if (!r.fired && r.remindAt <= now) {
      r.fired = true;
      due.push(r);
    }
  }
  return due;
}

/** Get a reminder by ID. */
export function getReminder(reminderId: string): Reminder | null {
  return store.get(reminderId) ?? null;
}

/** Count pending reminders for a user. */
export function pendingCount(userId: string): number {
  let count = 0;
  for (const r of store.values()) {
    if (r.userId === userId && !r.fired) count++;
  }
  return count;
}

/** Clear all reminders (for testing). */
export function clearAll(): void {
  store.clear();
}
