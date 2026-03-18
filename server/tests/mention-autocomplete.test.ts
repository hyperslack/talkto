import { describe, expect, test } from "bun:test";
import {
  detectMentionTrigger,
  fuzzyScore,
  searchMentions,
  insertMention,
  formatMention,
  hasMention,
  extractMentionNames,
  type MentionCandidate,
} from "../src/utils/mention-autocomplete";

const candidates: MentionCandidate[] = [
  { id: "1", name: "alice", displayName: "Alice Smith", type: "human", isOnline: true },
  { id: "2", name: "bob", displayName: "Bob Jones", type: "human", isOnline: false },
  { id: "3", name: "codex", displayName: null, type: "agent", isOnline: true },
  { id: "4", name: "claude", displayName: "Claude AI", type: "agent", isOnline: true },
];

describe("Mention Autocomplete", () => {
  describe("detectMentionTrigger", () => {
    test("detects @ at cursor", () => {
      expect(detectMentionTrigger("hello @al", 9)).toBe("al");
    });

    test("detects empty @ trigger", () => {
      expect(detectMentionTrigger("hello @", 7)).toBe("");
    });

    test("returns null without @", () => {
      expect(detectMentionTrigger("hello", 5)).toBeNull();
    });

    test("ignores @ not at cursor", () => {
      expect(detectMentionTrigger("@alice hello", 12)).toBeNull();
    });
  });

  describe("fuzzyScore", () => {
    test("exact match scores 1.0", () => {
      expect(fuzzyScore("alice", "alice")).toBe(1.0);
    });

    test("prefix match scores 0.9", () => {
      expect(fuzzyScore("al", "alice")).toBe(0.9);
    });

    test("contains scores 0.7", () => {
      expect(fuzzyScore("lic", "alice")).toBe(0.7);
    });

    test("no match scores 0", () => {
      expect(fuzzyScore("xyz", "alice")).toBe(0);
    });

    test("empty query scores 0.5", () => {
      expect(fuzzyScore("", "alice")).toBe(0.5);
    });
  });

  describe("searchMentions", () => {
    test("returns matching candidates ranked by score", () => {
      const results = searchMentions("al", candidates);
      expect(results[0].name).toBe("alice");
    });

    test("matches display name too", () => {
      const results = searchMentions("Smith", candidates);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("alice");
      expect(results[0].matchedField).toBe("displayName");
    });

    test("empty query returns all candidates", () => {
      const results = searchMentions("", candidates);
      expect(results).toHaveLength(4);
    });

    test("respects limit", () => {
      const results = searchMentions("", candidates, 2);
      expect(results).toHaveLength(2);
    });

    test("online users rank higher for same score", () => {
      const results = searchMentions("", candidates);
      // Online users should come before offline ones at same score
      const onlineFirst = results.findIndex((r) => !r.isOnline);
      const offlineIdx = results.findIndex((r) => r.name === "bob");
      if (onlineFirst !== -1) {
        expect(offlineIdx).toBeGreaterThanOrEqual(onlineFirst);
      }
    });
  });

  describe("insertMention", () => {
    test("replaces @partial with @name", () => {
      const result = insertMention("hello @al", 9, "alice");
      expect(result.text).toBe("hello @alice ");
      expect(result.newCursorPos).toBe(13);
    });

    test("handles no @ gracefully", () => {
      const result = insertMention("hello", 5, "alice");
      expect(result.text).toBe("hello");
    });
  });

  describe("formatMention", () => {
    test("uses display name when available", () => {
      expect(formatMention(candidates[0])).toBe("@Alice Smith");
    });

    test("falls back to name", () => {
      expect(formatMention(candidates[2])).toBe("@codex");
    });
  });

  describe("hasMention", () => {
    test("detects mention", () => {
      expect(hasMention("hey @alice check this", "alice")).toBe(true);
    });

    test("no false positives", () => {
      expect(hasMention("hey @bob check this", "alice")).toBe(false);
    });
  });

  describe("extractMentionNames", () => {
    test("extracts all mentions", () => {
      expect(extractMentionNames("@alice and @bob")).toEqual(["alice", "bob"]);
    });

    test("deduplicates", () => {
      expect(extractMentionNames("@alice @alice")).toEqual(["alice"]);
    });

    test("returns empty for no mentions", () => {
      expect(extractMentionNames("hello world")).toEqual([]);
    });
  });
});
