/**
 * Keyboard shortcut registry utilities.
 *
 * Provides a structured registry for keyboard shortcuts with conflict
 * detection, categorization, and platform-aware display formatting.
 */

export type ShortcutCategory =
  | "navigation"
  | "messaging"
  | "channels"
  | "search"
  | "formatting"
  | "general";

export interface ShortcutDef {
  id: string;
  keys: string; // e.g. "ctrl+k", "shift+enter"
  label: string;
  category: ShortcutCategory;
  /** Platform-specific key override (mac uses Cmd instead of Ctrl) */
  macKeys?: string;
}

/**
 * Shortcut registry with conflict detection.
 */
export class ShortcutRegistry {
  private shortcuts: Map<string, ShortcutDef> = new Map();

  /**
   * Register a shortcut. Returns false if the key combo conflicts.
   */
  register(shortcut: ShortcutDef): boolean {
    const existing = this.findByKeys(shortcut.keys);
    if (existing && existing.id !== shortcut.id) return false;
    this.shortcuts.set(shortcut.id, shortcut);
    return true;
  }

  /**
   * Unregister a shortcut.
   */
  unregister(id: string): boolean {
    return this.shortcuts.delete(id);
  }

  /**
   * Find a shortcut by its key combo.
   */
  findByKeys(keys: string): ShortcutDef | undefined {
    const normalized = normalizeKeys(keys);
    for (const s of this.shortcuts.values()) {
      if (normalizeKeys(s.keys) === normalized) return s;
    }
    return undefined;
  }

  /**
   * List all shortcuts, optionally filtered by category.
   */
  list(category?: ShortcutCategory): ShortcutDef[] {
    const all = Array.from(this.shortcuts.values());
    if (!category) return all;
    return all.filter((s) => s.category === category);
  }

  /**
   * List all categories that have shortcuts.
   */
  categories(): ShortcutCategory[] {
    const cats = new Set<ShortcutCategory>();
    for (const s of this.shortcuts.values()) cats.add(s.category);
    return Array.from(cats).sort();
  }

  /**
   * Check for key conflicts without registering.
   */
  hasConflict(keys: string, excludeId?: string): boolean {
    const existing = this.findByKeys(keys);
    return existing !== undefined && existing.id !== excludeId;
  }

  /**
   * Get total count of registered shortcuts.
   */
  get size(): number {
    return this.shortcuts.size;
  }
}

/**
 * Normalize a key combo string for comparison.
 * Sorts modifiers alphabetically, lowercases everything.
 */
export function normalizeKeys(keys: string): string {
  const parts = keys.toLowerCase().split("+").map((p) => p.trim());
  const modifiers = parts.filter((p) => ["ctrl", "alt", "shift", "meta", "cmd"].includes(p)).sort();
  const mainKeys = parts.filter((p) => !["ctrl", "alt", "shift", "meta", "cmd"].includes(p));
  return [...modifiers, ...mainKeys].join("+");
}

/**
 * Format keys for display with platform-appropriate symbols.
 */
export function formatKeysForDisplay(keys: string, isMac: boolean = false): string {
  const symbols: Record<string, string> = isMac
    ? { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘", cmd: "⌘" }
    : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Win" };

  return keys
    .split("+")
    .map((k) => {
      const lower = k.trim().toLowerCase();
      return symbols[lower] ?? k.trim().charAt(0).toUpperCase() + k.trim().slice(1);
    })
    .join(isMac ? "" : " + ");
}

/**
 * Get the display string for a shortcut, platform-aware.
 */
export function displayShortcut(shortcut: ShortcutDef, isMac: boolean = false): string {
  const keys = isMac && shortcut.macKeys ? shortcut.macKeys : shortcut.keys;
  return formatKeysForDisplay(keys, isMac);
}

/**
 * Create a default set of workspace shortcuts.
 */
export function defaultShortcuts(): ShortcutDef[] {
  return [
    { id: "search", keys: "ctrl+k", macKeys: "cmd+k", label: "Search", category: "search" },
    { id: "new-message", keys: "ctrl+n", macKeys: "cmd+n", label: "New message", category: "messaging" },
    { id: "send", keys: "enter", label: "Send message", category: "messaging" },
    { id: "newline", keys: "shift+enter", label: "New line", category: "messaging" },
    { id: "prev-channel", keys: "alt+up", label: "Previous channel", category: "navigation" },
    { id: "next-channel", keys: "alt+down", label: "Next channel", category: "navigation" },
    { id: "bold", keys: "ctrl+b", macKeys: "cmd+b", label: "Bold", category: "formatting" },
    { id: "italic", keys: "ctrl+i", macKeys: "cmd+i", label: "Italic", category: "formatting" },
    { id: "help", keys: "shift+?", label: "Shortcuts help", category: "general" },
  ];
}
