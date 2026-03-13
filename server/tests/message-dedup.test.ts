import { describe, it, expect } from "bun:test";
import {
  normalizeContent,
  jaccardSimilarity,
  checkDuplicate,
  DedupStore,
  type MessageEntry,
} from "../src/lib/message-dedup";

describe("normalizeContent", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeContent("  hello   world  ", false)).toBe("hello world");
  });

  it("lowercases when case-insensitive", () => {
    expect(normalizeContent("Hello World", false)).toBe("hello world");
  });

  it("preserves case when case-sensitive", () => {
    expect(normalizeContent("Hello World", true)).toBe("Hello World");
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(jaccardSimilarity("hello world", "foo bar")).toBe(0);
  });

  it("returns partial similarity for overlapping words", () => {
    const sim = jaccardSimilarity("hello world foo", "hello world bar");
    expect(sim).toBeCloseTo(0.5, 1); // 2 shared out of 4 union
  });

  it("returns 0 when one string is empty", () => {
    expect(jaccardSimilarity("hello", "")).toBe(0);
  });

  it("returns 1 for two empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
  });
});

describe("checkDuplicate", () => {
  const now = new Date().toISOString();
  const recentMessages: MessageEntry[] = [
    { id: "msg1", content: "Hello world", senderId: "u1", channelId: "c1", createdAt: now },
    { id: "msg2", content: "Different message", senderId: "u1", channelId: "c1", createdAt: now },
    { id: "msg3", content: "Hello world", senderId: "u2", channelId: "c1", createdAt: now },
  ];

  it("detects exact duplicate from same sender in same channel", () => {
    const result = checkDuplicate(
      { content: "Hello world", senderId: "u1", channelId: "c1" },
      recentMessages
    );
    expect(result.isDuplicate).toBe(true);
    expect(result.originalMessageId).toBe("msg1");
    expect(result.similarity).toBe(1);
  });

  it("ignores duplicates from different sender", () => {
    const result = checkDuplicate(
      { content: "Hello world", senderId: "u3", channelId: "c1" },
      recentMessages
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("ignores duplicates from different channel", () => {
    const result = checkDuplicate(
      { content: "Hello world", senderId: "u1", channelId: "c2" },
      recentMessages
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("treats empty content as non-duplicate", () => {
    const result = checkDuplicate(
      { content: "  ", senderId: "u1", channelId: "c1" },
      recentMessages
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("ignores messages outside the time window", () => {
    const oldTime = new Date(Date.now() - 120_000).toISOString();
    const oldMessages: MessageEntry[] = [
      { id: "old1", content: "Hello world", senderId: "u1", channelId: "c1", createdAt: oldTime },
    ];
    const result = checkDuplicate(
      { content: "Hello world", senderId: "u1", channelId: "c1" },
      oldMessages,
      { windowMs: 60_000 }
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("detects fuzzy duplicates with lower threshold", () => {
    const result = checkDuplicate(
      { content: "Hello world foo", senderId: "u1", channelId: "c1" },
      [{ id: "msg1", content: "Hello world bar", senderId: "u1", channelId: "c1", createdAt: now }],
      { similarityThreshold: 0.4 }
    );
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.4);
  });
});

describe("DedupStore", () => {
  it("detects duplicates after adding entries", () => {
    const store = new DedupStore(100, 60_000);
    store.add({ id: "m1", content: "test msg", senderId: "u1", channelId: "c1", createdAt: new Date().toISOString() });
    
    const result = store.check({ content: "test msg", senderId: "u1", channelId: "c1" });
    expect(result.isDuplicate).toBe(true);
  });

  it("allows non-duplicate messages", () => {
    const store = new DedupStore(100, 60_000);
    store.add({ id: "m1", content: "first message", senderId: "u1", channelId: "c1", createdAt: new Date().toISOString() });
    
    const result = store.check({ content: "second message", senderId: "u1", channelId: "c1" });
    expect(result.isDuplicate).toBe(false);
  });

  it("tracks size correctly", () => {
    const store = new DedupStore(100, 60_000);
    expect(store.size).toBe(0);
    store.add({ id: "m1", content: "hello", senderId: "u1", channelId: "c1", createdAt: new Date().toISOString() });
    expect(store.size).toBe(1);
  });

  it("prunes entries exceeding maxEntries", () => {
    const store = new DedupStore(2, 60_000);
    const now = new Date().toISOString();
    store.add({ id: "m1", content: "a", senderId: "u1", channelId: "c1", createdAt: now });
    store.add({ id: "m2", content: "b", senderId: "u1", channelId: "c1", createdAt: now });
    store.add({ id: "m3", content: "c", senderId: "u1", channelId: "c1", createdAt: now });
    expect(store.size).toBeLessThanOrEqual(2);
  });
});
