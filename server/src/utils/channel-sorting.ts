/**
 * Channel sorting utilities.
 *
 * Provides composable sort functions for channel lists,
 * supporting multiple criteria like alphabetical, activity, unread count, etc.
 */

export interface SortableChannel {
  id: string;
  name: string;
  type?: string;
  is_archived?: boolean;
  created_at?: string;
  last_message_at?: string | null;
  unread_count?: number;
  member_count?: number;
  position?: number | null;
}

export type SortField =
  | "name"
  | "created_at"
  | "last_message_at"
  | "unread_count"
  | "member_count"
  | "position";

export type SortDirection = "asc" | "desc";

export interface SortCriteria {
  field: SortField;
  direction: SortDirection;
}

/** Sort channels alphabetically by name. */
export function sortByName(channels: SortableChannel[], direction: SortDirection = "asc"): SortableChannel[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...channels].sort((a, b) => mult * a.name.localeCompare(b.name));
}

/** Sort channels by most recent activity (last_message_at). Channels with no activity sort last. */
export function sortByActivity(channels: SortableChannel[], direction: SortDirection = "desc"): SortableChannel[] {
  const mult = direction === "desc" ? -1 : 1;
  return [...channels].sort((a, b) => {
    const aTime = a.last_message_at ?? "";
    const bTime = b.last_message_at ?? "";
    if (!aTime && !bTime) return 0;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return mult * aTime.localeCompare(bTime);
  });
}

/** Sort channels by unread count (highest first by default). */
export function sortByUnread(channels: SortableChannel[], direction: SortDirection = "desc"): SortableChannel[] {
  const mult = direction === "desc" ? -1 : 1;
  return [...channels].sort((a, b) => mult * ((a.unread_count ?? 0) - (b.unread_count ?? 0)));
}

/** Sort channels by member count. */
export function sortByMemberCount(channels: SortableChannel[], direction: SortDirection = "desc"): SortableChannel[] {
  const mult = direction === "desc" ? -1 : 1;
  return [...channels].sort((a, b) => mult * ((a.member_count ?? 0) - (b.member_count ?? 0)));
}

/** Sort channels by custom position, then name. */
export function sortByPosition(channels: SortableChannel[]): SortableChannel[] {
  return [...channels].sort((a, b) => {
    const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
    const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;
    return a.name.localeCompare(b.name);
  });
}

/** Sort by creation date. */
export function sortByCreatedAt(channels: SortableChannel[], direction: SortDirection = "desc"): SortableChannel[] {
  const mult = direction === "desc" ? -1 : 1;
  return [...channels].sort((a, b) => {
    const aTime = a.created_at ?? "";
    const bTime = b.created_at ?? "";
    return mult * aTime.localeCompare(bTime);
  });
}

/** Generic multi-criteria sort. Earlier criteria take priority. */
export function sortByMultiple(channels: SortableChannel[], criteria: SortCriteria[]): SortableChannel[] {
  const sorters: Record<SortField, (ch: SortableChannel[], dir: SortDirection) => SortableChannel[]> = {
    name: sortByName,
    created_at: sortByCreatedAt,
    last_message_at: sortByActivity,
    unread_count: sortByUnread,
    member_count: sortByMemberCount,
    position: (ch) => sortByPosition(ch),
  };

  let result = [...channels];
  // Apply in reverse order so highest priority ends up on top
  for (let i = criteria.length - 1; i >= 0; i--) {
    const { field, direction } = criteria[i];
    const sorter = sorters[field];
    if (sorter) result = sorter(result, direction);
  }
  return result;
}

/** Partition channels into archived and active. */
export function partitionArchived(channels: SortableChannel[]): {
  active: SortableChannel[];
  archived: SortableChannel[];
} {
  const active: SortableChannel[] = [];
  const archived: SortableChannel[] = [];
  for (const ch of channels) {
    if (ch.is_archived) archived.push(ch);
    else active.push(ch);
  }
  return { active, archived };
}

/** Group channels by type. */
export function groupByType(channels: SortableChannel[]): Map<string, SortableChannel[]> {
  const groups = new Map<string, SortableChannel[]>();
  for (const ch of channels) {
    const type = ch.type ?? "unknown";
    const list = groups.get(type) ?? [];
    list.push(ch);
    groups.set(type, list);
  }
  return groups;
}

/** Filter to channels with unread messages. */
export function withUnreads(channels: SortableChannel[]): SortableChannel[] {
  return channels.filter((ch) => (ch.unread_count ?? 0) > 0);
}
