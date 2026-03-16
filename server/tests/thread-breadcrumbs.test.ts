import { describe, test, expect } from "bun:test";
import {
  buildBreadcrumbs,
  generatePreview,
  formatBreadcrumbPath,
  formatDetailedBreadcrumbs,
  isDeepThread,
  getRecentAncestors,
  getThreadParticipants,
  type MessageLookup,
} from "../src/lib/thread-breadcrumbs";

const messages: Record<string, { id: string; senderId: string; senderName: string; content: string; parentId: string | null }> = {
  m1: { id: "m1", senderId: "u1", senderName: "Alice", content: "Root message", parentId: null },
  m2: { id: "m2", senderId: "u2", senderName: "Bob", content: "Reply to root", parentId: "m1" },
  m3: { id: "m3", senderId: "u3", senderName: "Charlie", content: "Reply to Bob", parentId: "m2" },
  m4: { id: "m4", senderId: "u1", senderName: "Alice", content: "Deep reply", parentId: "m3" },
};

const lookup: MessageLookup = (id) => messages[id] ?? null;

describe("buildBreadcrumbs", () => {
  test("builds path from leaf to root", () => {
    const path = buildBreadcrumbs("m3", lookup);
    expect(path.nodes).toHaveLength(3);
    expect(path.nodes[0].senderName).toBe("Alice");
    expect(path.nodes[2].senderName).toBe("Charlie");
    expect(path.rootMessageId).toBe("m1");
  });

  test("handles root message", () => {
    const path = buildBreadcrumbs("m1", lookup);
    expect(path.nodes).toHaveLength(1);
    expect(path.totalDepth).toBe(1);
  });

  test("handles missing message", () => {
    const path = buildBreadcrumbs("nonexistent", lookup);
    expect(path.nodes).toHaveLength(0);
  });

  test("respects maxDepth", () => {
    const path = buildBreadcrumbs("m4", lookup, 2);
    expect(path.nodes.length).toBeLessThanOrEqual(2);
  });

  test("numbers depths correctly", () => {
    const path = buildBreadcrumbs("m4", lookup);
    expect(path.nodes[0].depth).toBe(0);
    expect(path.nodes[1].depth).toBe(1);
    expect(path.nodes[2].depth).toBe(2);
    expect(path.nodes[3].depth).toBe(3);
  });
});

describe("generatePreview", () => {
  test("returns short content as-is", () => {
    expect(generatePreview("Hello")).toBe("Hello");
  });

  test("truncates long content", () => {
    const long = "word ".repeat(30).trim();
    const preview = generatePreview(long, 40);
    expect(preview.length).toBeLessThanOrEqual(42);
    expect(preview).toEndWith("…");
  });

  test("collapses newlines", () => {
    expect(generatePreview("line1\nline2\nline3")).toBe("line1 line2 line3");
  });
});

describe("formatBreadcrumbPath", () => {
  test("formats as sender chain", () => {
    const path = buildBreadcrumbs("m3", lookup);
    expect(formatBreadcrumbPath(path)).toBe("Alice › Bob › Charlie");
  });

  test("handles empty path", () => {
    const path = buildBreadcrumbs("nonexistent", lookup);
    expect(formatBreadcrumbPath(path)).toBe("");
  });
});

describe("formatDetailedBreadcrumbs", () => {
  test("formats with indentation and previews", () => {
    const path = buildBreadcrumbs("m3", lookup);
    const formatted = formatDetailedBreadcrumbs(path);
    expect(formatted).toContain("Alice: Root message");
    expect(formatted).toContain("  Bob: Reply to root");
    expect(formatted).toContain("    Charlie: Reply to Bob");
  });
});

describe("isDeepThread", () => {
  test("returns false for shallow threads", () => {
    const path = buildBreadcrumbs("m2", lookup);
    expect(isDeepThread(path, 5)).toBe(false);
  });

  test("returns true for deep threads", () => {
    const path = buildBreadcrumbs("m4", lookup);
    expect(isDeepThread(path, 3)).toBe(true);
  });
});

describe("getRecentAncestors", () => {
  test("returns ancestors before current message", () => {
    const path = buildBreadcrumbs("m4", lookup);
    const ancestors = getRecentAncestors(path, 2);
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0].senderName).toBe("Bob");
    expect(ancestors[1].senderName).toBe("Charlie");
  });

  test("returns empty for root message", () => {
    const path = buildBreadcrumbs("m1", lookup);
    expect(getRecentAncestors(path)).toEqual([]);
  });
});

describe("getThreadParticipants", () => {
  test("returns unique participants in order", () => {
    const path = buildBreadcrumbs("m4", lookup);
    const participants = getThreadParticipants(path);
    expect(participants).toEqual(["Alice", "Bob", "Charlie"]);
  });
});
