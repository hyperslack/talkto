/**
 * Tests for OpenCode SDK client manager and discovery utilities.
 *
 * These tests focus on the pure utility functions (matchSessionByProject,
 * extractTextFromParts) that don't require a live OpenCode server.
 */

import { describe, test, expect } from "bun:test";
import { matchSessionByProject, extractTextFromParts } from "../src/sdk/opencode";
import type { Session, Part, TextPart } from "@opencode-ai/sdk";

// ---------------------------------------------------------------------------
// Helper: create a mock Session
// ---------------------------------------------------------------------------

function mockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "ses_test123",
    projectID: "proj_test",
    directory: "/Users/test/project",
    title: "Test session",
    version: "1.0.0",
    time: { created: Date.now(), updated: Date.now() },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// matchSessionByProject
// ---------------------------------------------------------------------------

describe("matchSessionByProject", () => {
  test("exact match", () => {
    const sessions = [
      mockSession({ id: "ses_1", directory: "/Users/test/project-a" }),
      mockSession({ id: "ses_2", directory: "/Users/test/project-b" }),
    ];
    const result = matchSessionByProject(sessions, "/Users/test/project-b");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ses_2");
  });

  test("exact match with trailing slash normalization", () => {
    const sessions = [
      mockSession({ id: "ses_1", directory: "/Users/test/project/" }),
    ];
    const result = matchSessionByProject(sessions, "/Users/test/project");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ses_1");
  });

  test("parent directory match", () => {
    const sessions = [
      mockSession({ id: "ses_1", directory: "/Users/test/monorepo" }),
    ];
    const result = matchSessionByProject(
      sessions,
      "/Users/test/monorepo/packages/backend"
    );
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ses_1");
  });

  test("child directory match", () => {
    const sessions = [
      mockSession({
        id: "ses_1",
        directory: "/Users/test/project/packages/server",
      }),
    ];
    const result = matchSessionByProject(sessions, "/Users/test/project");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ses_1");
  });

  test("no match returns null", () => {
    const sessions = [
      mockSession({ id: "ses_1", directory: "/Users/test/other-project" }),
    ];
    const result = matchSessionByProject(sessions, "/Users/test/my-project");
    expect(result).toBeNull();
  });

  test("empty sessions returns null", () => {
    const result = matchSessionByProject([], "/Users/test/project");
    expect(result).toBeNull();
  });

  test("prefers exact match over parent match", () => {
    const sessions = [
      mockSession({ id: "ses_parent", directory: "/Users/test" }),
      mockSession({ id: "ses_exact", directory: "/Users/test/project" }),
    ];
    const result = matchSessionByProject(sessions, "/Users/test/project");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ses_exact");
  });

  test("does not match partial directory names", () => {
    const sessions = [
      mockSession({ id: "ses_1", directory: "/Users/test/proj" }),
    ];
    // "/Users/test/project" should NOT match "/Users/test/proj"
    const result = matchSessionByProject(sessions, "/Users/test/project");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractTextFromParts
// ---------------------------------------------------------------------------

describe("extractTextFromParts", () => {
  const basePart = {
    id: "part_1",
    sessionID: "ses_1",
    messageID: "msg_1",
  };

  test("extracts text from TextPart", () => {
    const parts: Part[] = [
      { ...basePart, type: "text", text: "Hello, world!" } as TextPart,
    ];
    expect(extractTextFromParts(parts)).toBe("Hello, world!");
  });

  test("concatenates multiple text parts", () => {
    const parts: Part[] = [
      { ...basePart, id: "p1", type: "text", text: "First part" } as TextPart,
      { ...basePart, id: "p2", type: "text", text: "Second part" } as TextPart,
    ];
    expect(extractTextFromParts(parts)).toBe("First part\nSecond part");
  });

  test("ignores non-text parts", () => {
    const parts: Part[] = [
      { ...basePart, type: "text", text: "The answer is 42" } as TextPart,
      {
        ...basePart,
        id: "p2",
        type: "tool",
        callID: "call_1",
        tool: "Read",
        state: { status: "completed", input: {}, output: "file content", title: "Read", metadata: {}, time: { start: 0, end: 1 } },
      } as Part,
      {
        ...basePart,
        id: "p3",
        type: "reasoning",
        text: "thinking...",
        time: { start: 0 },
      } as Part,
    ];
    expect(extractTextFromParts(parts)).toBe("The answer is 42");
  });

  test("skips ignored text parts", () => {
    const parts: Part[] = [
      { ...basePart, id: "p1", type: "text", text: "Keep this" } as TextPart,
      {
        ...basePart,
        id: "p2",
        type: "text",
        text: "Skip this",
        ignored: true,
      } as TextPart,
    ];
    expect(extractTextFromParts(parts)).toBe("Keep this");
  });

  test("returns empty string for no text parts", () => {
    const parts: Part[] = [
      {
        ...basePart,
        type: "tool",
        callID: "call_1",
        tool: "Bash",
        state: { status: "completed", input: {}, output: "done", title: "Bash", metadata: {}, time: { start: 0, end: 1 } },
      } as Part,
    ];
    expect(extractTextFromParts(parts)).toBe("");
  });

  test("trims whitespace from result", () => {
    const parts: Part[] = [
      { ...basePart, type: "text", text: "  trimmed  " } as TextPart,
    ];
    expect(extractTextFromParts(parts)).toBe("trimmed");
  });

  test("handles empty parts array", () => {
    expect(extractTextFromParts([])).toBe("");
  });
});
