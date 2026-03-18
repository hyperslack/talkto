import { describe, expect, test } from "bun:test";
import {
  encodeCursor,
  decodeCursor,
  isValidCursor,
  cursorFromItem,
  buildPaginationMeta,
  clampLimit,
  parsePaginationParams,
} from "../src/utils/pagination-cursor";

describe("Pagination Cursor Utilities", () => {
  test("encodeCursor and decodeCursor roundtrip", () => {
    const payload = { value: "2026-03-18T00:00:00Z", id: "abc-123", direction: "desc" as const };
    const cursor = encodeCursor(payload);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(payload);
  });

  test("decodeCursor returns null for invalid input", () => {
    expect(decodeCursor("not-valid-base64!!!")).toBeNull();
  });

  test("decodeCursor returns null for valid base64 but missing fields", () => {
    const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });

  test("isValidCursor returns true for valid cursor", () => {
    const cursor = encodeCursor({ value: "x", id: "1", direction: "asc" });
    expect(isValidCursor(cursor)).toBe(true);
  });

  test("isValidCursor returns false for invalid cursor", () => {
    expect(isValidCursor("garbage")).toBe(false);
  });

  test("cursorFromItem builds cursor from item", () => {
    const item = { id: "msg-1", created_at: "2026-03-18T00:00:00Z" };
    const cursor = cursorFromItem(item, "created_at", "desc");
    const decoded = decodeCursor(cursor);
    expect(decoded!.value).toBe("2026-03-18T00:00:00Z");
    expect(decoded!.id).toBe("msg-1");
    expect(decoded!.direction).toBe("desc");
  });

  test("buildPaginationMeta with more results", () => {
    const items = [
      { id: "1", created_at: "2026-03-18" },
      { id: "2", created_at: "2026-03-17" },
    ];
    const meta = buildPaginationMeta(items, "created_at", "desc", 2);
    expect(meta.hasMore).toBe(true);
    expect(meta.nextCursor).not.toBeNull();
    expect(meta.count).toBe(2);
  });

  test("buildPaginationMeta without more results", () => {
    const items = [{ id: "1", created_at: "2026-03-18" }];
    const meta = buildPaginationMeta(items, "created_at", "desc", 10);
    expect(meta.hasMore).toBe(false);
    expect(meta.nextCursor).toBeNull();
  });

  test("clampLimit uses default for missing value", () => {
    expect(clampLimit(undefined)).toBe(50);
  });

  test("clampLimit clamps to max", () => {
    expect(clampLimit(500, 50, 200)).toBe(200);
  });

  test("clampLimit uses default for invalid value", () => {
    expect(clampLimit(0)).toBe(50);
    expect(clampLimit(-1)).toBe(50);
  });

  test("parsePaginationParams parses all fields", () => {
    const cursor = encodeCursor({ value: "x", id: "1", direction: "asc" });
    const result = parsePaginationParams({ cursor, limit: "25", direction: "asc" });
    expect(result.cursor).not.toBeNull();
    expect(result.limit).toBe(25);
    expect(result.direction).toBe("asc");
  });

  test("parsePaginationParams defaults", () => {
    const result = parsePaginationParams({});
    expect(result.cursor).toBeNull();
    expect(result.limit).toBe(50);
    expect(result.direction).toBe("desc");
  });
});
