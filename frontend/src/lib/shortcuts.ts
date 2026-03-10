/** Keyboard shortcut definitions shared between UI and tests. */

export interface Shortcut {
  keys: string[];
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], description: "Search messages" },
  { keys: ["⌘", "B"], description: "Toggle sidebar" },
  { keys: ["⌘", "⇧", "F"], description: "Toggle feature requests" },
  { keys: ["Esc"], description: "Close panels / clear search" },
  { keys: ["?"], description: "Show this help dialog" },
];
