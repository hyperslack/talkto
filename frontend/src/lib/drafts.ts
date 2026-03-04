/**
 * Message draft persistence — stores per-channel drafts in localStorage.
 */

const STORAGE_KEY = "talkto-drafts";

/** Get all drafts from localStorage. */
function getDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save all drafts to localStorage. */
function saveDrafts(drafts: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Get the draft for a specific channel. */
export function getDraft(channelId: string): string {
  return getDrafts()[channelId] ?? "";
}

/** Save a draft for a specific channel. Empty string clears the draft. */
export function saveDraft(channelId: string, content: string): void {
  const drafts = getDrafts();
  if (content.trim()) {
    drafts[channelId] = content;
  } else {
    delete drafts[channelId];
  }
  saveDrafts(drafts);
}

/** Clear the draft for a specific channel. */
export function clearDraft(channelId: string): void {
  const drafts = getDrafts();
  delete drafts[channelId];
  saveDrafts(drafts);
}

/** Check if a channel has a draft. */
export function hasDraft(channelId: string): boolean {
  return Boolean(getDrafts()[channelId]?.trim());
}
