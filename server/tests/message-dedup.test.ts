import { describe, expect, test } from "bun:test";
import {
  isDuplicate,
  deduplicateMessages,
  findDuplicateGroups,
  countDuplicates,
  contentFingerprint,
  isSimilarContent,
  DedupGuard,
  type DeduplicableMessage,
} from "../src/utils/message-dedup";

const base = "2026-03-18T00:00:00.000Z";
const msg = (id: string, sender: string, content: string, offsetMs = 0): DeduplicableMessage => ({
  id,
  sender_id: sender,
  content,
  created_at: new Date(new Date(base).getTime() + offsetMs).toISOString(),
});

describe("Message Deduplication", () => {
  test("isDuplicate detects same sender, content, within window", () => {
    const a = msg("1", "user1", "hello", 0);
    const b = msg("2", "user1", "hello", 1000);
    expect(isDuplicate(a, b)).toBe(true);
  });

  test("isDuplicate rejects different sender", () => {
    const a = msg("1", "user1", "hello", 0);
    const b = msg("2", "user2", "hello", 1000);
    expect(isDuplicate(a, b)).toBe(false);
  });

  test("isDuplicate rejects different content", () => {
    const a = msg("1", "user1", "hello", 0);
    const b = msg("2", "user1", "world", 1000);
    expect(isDuplicate(a, b)).toBe(false);
  });

  test("isDuplicate rejects outside time window", () => {
    const a = msg("1", "user1", "hello", 0);
    const b = msg("2", "user1", "hello", 10000);
    expect(isDuplicate(a, b, 5000)).toBe(false);
  });

  test("isDuplicate rejects same message ID", () => {
    const a = msg("1", "user1", "hello", 0);
    expect(isDuplicate(a, a)).toBe(false);
  });

  test("deduplicateMessages removes duplicates", () => {
    const messages = [
      msg("1", "u1", "hello", 0),
      msg("2", "u1", "hello", 1000),
      msg("3", "u1", "world", 2000),
    ];
    const result = deduplicateMessages(messages);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["1", "3"]);
  });

  test("findDuplicateGroups groups correctly", () => {
    const messages = [
      msg("1", "u1", "hello", 0),
      msg("2", "u1", "hello", 500),
      msg("3", "u1", "hello", 1000),
      msg("4", "u2", "hi", 0),
    ];
    const groups = findDuplicateGroups(messages);
    expect(groups).toHaveLength(1);
    expect(groups[0].original.id).toBe("1");
    expect(groups[0].duplicates).toHaveLength(2);
  });

  test("countDuplicates returns correct count", () => {
    const messages = [
      msg("1", "u1", "hello", 0),
      msg("2", "u1", "hello", 500),
      msg("3", "u2", "hi", 0),
    ];
    expect(countDuplicates(messages)).toBe(1);
  });

  test("contentFingerprint normalizes whitespace and case", () => {
    expect(contentFingerprint("  Hello   World  ")).toBe("hello world");
  });

  test("isSimilarContent ignores case and whitespace", () => {
    expect(isSimilarContent("Hello World", "  hello   world  ")).toBe(true);
    expect(isSimilarContent("hello", "world")).toBe(false);
  });
});

describe("DedupGuard", () => {
  test("allows first message", () => {
    const guard = new DedupGuard();
    expect(guard.check("u1", "hello")).toBe(false);
  });

  test("rejects duplicate within window", () => {
    const guard = new DedupGuard();
    guard.check("u1", "hello");
    expect(guard.check("u1", "hello")).toBe(true);
  });

  test("allows different content", () => {
    const guard = new DedupGuard();
    guard.check("u1", "hello");
    expect(guard.check("u1", "world")).toBe(false);
  });

  test("allows different sender", () => {
    const guard = new DedupGuard();
    guard.check("u1", "hello");
    expect(guard.check("u2", "hello")).toBe(false);
  });

  test("clear resets state", () => {
    const guard = new DedupGuard();
    guard.check("u1", "hello");
    guard.clear();
    expect(guard.check("u1", "hello")).toBe(false);
  });

  test("size returns tracked count", () => {
    const guard = new DedupGuard();
    guard.check("u1", "hello");
    guard.check("u1", "world");
    expect(guard.size()).toBe(2);
  });
});
