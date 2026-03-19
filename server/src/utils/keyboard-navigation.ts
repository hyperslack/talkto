/**
 * Keyboard navigation utilities — manages focus movement through
 * navigable items (channels, messages, agents) using arrow keys.
 */

export interface NavigableItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface NavigationState {
  items: NavigableItem[];
  focusedIndex: number;
  wrap: boolean;
}

/**
 * Create a new navigation state.
 */
export function createNavState(
  items: NavigableItem[],
  initialIndex: number = 0,
  wrap: boolean = true,
): NavigationState {
  return {
    items,
    focusedIndex: clampIndex(initialIndex, items.length),
    wrap,
  };
}

/**
 * Move focus to the next enabled item.
 */
export function moveNext(state: NavigationState): NavigationState {
  const { items, focusedIndex, wrap } = state;
  if (items.length === 0) return state;

  let next = focusedIndex + 1;
  // Skip disabled items
  while (next < items.length && items[next]?.disabled) next++;

  if (next >= items.length) {
    if (wrap) {
      next = 0;
      while (next < items.length && items[next]?.disabled) next++;
    } else {
      return state; // Don't move past end
    }
  }

  return { ...state, focusedIndex: clampIndex(next, items.length) };
}

/**
 * Move focus to the previous enabled item.
 */
export function movePrev(state: NavigationState): NavigationState {
  const { items, focusedIndex, wrap } = state;
  if (items.length === 0) return state;

  let prev = focusedIndex - 1;
  while (prev >= 0 && items[prev]?.disabled) prev--;

  if (prev < 0) {
    if (wrap) {
      prev = items.length - 1;
      while (prev >= 0 && items[prev]?.disabled) prev--;
    } else {
      return state; // Don't move before start
    }
  }

  return { ...state, focusedIndex: clampIndex(prev, items.length) };
}

/**
 * Move to a specific item by ID.
 */
export function moveTo(state: NavigationState, id: string): NavigationState {
  const index = state.items.findIndex((item) => item.id === id);
  if (index === -1) return state;
  return { ...state, focusedIndex: index };
}

/**
 * Get the currently focused item.
 */
export function getFocused(state: NavigationState): NavigableItem | null {
  if (state.items.length === 0) return null;
  return state.items[state.focusedIndex] ?? null;
}

/**
 * Move focus to first item.
 */
export function moveToFirst(state: NavigationState): NavigationState {
  let idx = 0;
  while (idx < state.items.length && state.items[idx]?.disabled) idx++;
  return { ...state, focusedIndex: clampIndex(idx, state.items.length) };
}

/**
 * Move focus to last item.
 */
export function moveToLast(state: NavigationState): NavigationState {
  let idx = state.items.length - 1;
  while (idx >= 0 && state.items[idx]?.disabled) idx--;
  return { ...state, focusedIndex: clampIndex(Math.max(0, idx), state.items.length) };
}

/**
 * Find items matching a search query (for type-ahead).
 */
export function typeAhead(state: NavigationState, query: string): NavigationState {
  if (!query) return state;
  const lower = query.toLowerCase();
  const index = state.items.findIndex(
    (item) => !item.disabled && item.label.toLowerCase().startsWith(lower),
  );
  if (index === -1) return state;
  return { ...state, focusedIndex: index };
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}
