/**
 * Pagination cursor utilities.
 *
 * Encode/decode opaque cursor tokens for stable cursor-based pagination.
 * Supports multiple sort fields and directions.
 */

export interface CursorPayload {
  /** Primary sort value (e.g., created_at ISO string). */
  value: string;
  /** Record ID for tiebreaking. */
  id: string;
  /** Sort direction used when this cursor was created. */
  direction: "asc" | "desc";
}

/**
 * Encode a cursor payload into an opaque base64 string.
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString("base64url");
}

/**
 * Decode a cursor string back into a payload. Returns null if invalid.
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (!parsed.value || !parsed.id || !parsed.direction) return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

/**
 * Check whether a cursor string is valid.
 */
export function isValidCursor(cursor: string): boolean {
  return decodeCursor(cursor) !== null;
}

/**
 * Build a cursor from the last item in a page of results.
 */
export function cursorFromItem(
  item: { id: string; [key: string]: unknown },
  sortField: string,
  direction: "asc" | "desc" = "desc"
): string {
  const value = String(item[sortField] ?? "");
  return encodeCursor({ value, id: item.id, direction });
}

/**
 * Build pagination metadata for a response.
 */
export function buildPaginationMeta(
  items: Array<{ id: string; [key: string]: unknown }>,
  sortField: string,
  direction: "asc" | "desc",
  limit: number
): {
  hasMore: boolean;
  nextCursor: string | null;
  count: number;
} {
  const hasMore = items.length >= limit;
  const nextCursor =
    hasMore && items.length > 0
      ? cursorFromItem(items[items.length - 1], sortField, direction)
      : null;
  return { hasMore, nextCursor, count: items.length };
}

/**
 * Clamp a limit value to a safe range.
 */
export function clampLimit(
  requested: number | undefined,
  defaultLimit = 50,
  maxLimit = 200
): number {
  if (!requested || requested < 1) return defaultLimit;
  return Math.min(requested, maxLimit);
}

/**
 * Parse pagination params from query string.
 */
export function parsePaginationParams(query: {
  cursor?: string;
  limit?: string;
  direction?: string;
}): {
  cursor: CursorPayload | null;
  limit: number;
  direction: "asc" | "desc";
} {
  return {
    cursor: query.cursor ? decodeCursor(query.cursor) : null,
    limit: clampLimit(query.limit ? parseInt(query.limit, 10) : undefined),
    direction: query.direction === "asc" ? "asc" : "desc",
  };
}
