/**
 * Tests for Cursor CLI SDK wrapper.
 *
 * Pure unit tests — no live Cursor subprocess. Tests cover:
 * - NDJSON event parsing (parseCursorEvent)
 * - Session liveness tracking (in-process Set)
 * - Session busy tracking
 * - Session metadata (setCursorSessionMeta / getCursorSessionMeta)
 * - CLI discovery cache (findCursorCli / resetCliCache)
 * - Event type discrimination
 * - Lifecycle simulation (registration → alive → invocation → ghost → re-register)
 *
 * Follows the same patterns as codex.test.ts and claude.test.ts.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  parseCursorEvent,
  resetCliCache,
  markSessionAlive,
  markSessionDead,
  isSessionAlive,
  isSessionBusy,
  setCursorSessionMeta,
  getCursorSessionMeta,
} from "../src/sdk/cursor";
import type {
  CursorEvent,
  CursorSystemEvent,
  CursorAssistantEvent,
  CursorResultEvent,
  CursorToolCallEvent,
  CursorUserEvent,
} from "../src/sdk/cursor";
import { agentStreamingEvent, agentTypingEvent } from "../src/services/broadcaster";

// ── parseCursorEvent ────────────────────────────────────────────

describe("parseCursorEvent", () => {
  test("parses system init event", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sess_001",
      model: "claude-sonnet-4-20250514",
      cwd: "/home/user/project",
    });
    const event = parseCursorEvent(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("system");
    const sys = event as CursorSystemEvent;
    expect(sys.subtype).toBe("init");
    expect(sys.session_id).toBe("sess_001");
    expect(sys.model).toBe("claude-sonnet-4-20250514");
    expect(sys.cwd).toBe("/home/user/project");
  });

  test("rejects system event with non-init subtype", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "shutdown",
      session_id: "sess_001",
    });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("parses assistant event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("assistant");
    const asst = event as CursorAssistantEvent;
    expect(asst.message.role).toBe("assistant");
    expect(asst.message.content).toHaveLength(1);
    expect(asst.message.content[0].text).toBe("Hello");
    expect(asst.session_id).toBe("sess_001");
  });

  test("parses assistant event with multiple content blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "First part" },
          { type: "text", text: " second part" },
        ],
      },
      session_id: "sess_002",
    });
    const event = parseCursorEvent(line) as CursorAssistantEvent;
    expect(event).not.toBeNull();
    expect(event.message.content).toHaveLength(2);
    expect(event.message.content[0].text).toBe("First part");
    expect(event.message.content[1].text).toBe(" second part");
  });

  test("rejects assistant event with wrong role", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("rejects assistant event with non-array content", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: "just a string",
      },
    });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("parses result success event", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "The answer is 42",
      duration_ms: 5432,
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("result");
    const res = event as CursorResultEvent;
    expect(res.subtype).toBe("success");
    expect(res.result).toBe("The answer is 42");
    expect(res.duration_ms).toBe(5432);
    expect(res.session_id).toBe("sess_001");
    expect(res.is_error).toBeUndefined();
  });

  test("parses result error event", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "error",
      is_error: true,
      result: "Model rate limited",
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line) as CursorResultEvent;
    expect(event).not.toBeNull();
    expect(event.subtype).toBe("error");
    expect(event.is_error).toBe(true);
    expect(event.result).toBe("Model rate limited");
  });

  test("parses result event with minimal fields", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
    });
    const event = parseCursorEvent(line) as CursorResultEvent;
    expect(event).not.toBeNull();
    expect(event.subtype).toBe("success");
    expect(event.result).toBeUndefined();
    expect(event.duration_ms).toBeUndefined();
  });

  test("parses tool_call started event", () => {
    const line = JSON.stringify({
      type: "tool_call",
      subtype: "started",
      call_id: "call_abc123",
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("tool_call");
    const tc = event as CursorToolCallEvent;
    expect(tc.subtype).toBe("started");
    expect(tc.call_id).toBe("call_abc123");
  });

  test("parses tool_call completed event", () => {
    const line = JSON.stringify({
      type: "tool_call",
      subtype: "completed",
      call_id: "call_abc123",
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line) as CursorToolCallEvent;
    expect(event).not.toBeNull();
    expect(event.subtype).toBe("completed");
  });

  test("parses user event", () => {
    const line = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Fix the bug" }],
      },
      session_id: "sess_001",
    });
    const event = parseCursorEvent(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("user");
    const usr = event as CursorUserEvent;
    expect(usr.message.role).toBe("user");
    expect(usr.message.content[0].text).toBe("Fix the bug");
  });

  test("returns null for unknown event type", () => {
    const line = JSON.stringify({
      type: "unknown_future_event",
      data: { foo: "bar" },
    });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseCursorEvent("{not valid json")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseCursorEvent("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(parseCursorEvent("   \n  ")).toBeNull();
  });

  test("returns null for object without type field", () => {
    const line = JSON.stringify({ data: "no type" });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("returns null for non-string type field", () => {
    const line = JSON.stringify({ type: 42 });
    expect(parseCursorEvent(line)).toBeNull();
  });

  test("returns null for array JSON", () => {
    expect(parseCursorEvent("[1, 2, 3]")).toBeNull();
  });

  test("returns null for null JSON", () => {
    expect(parseCursorEvent("null")).toBeNull();
  });

  test("preserves extra fields (backward-compatible)", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "Done",
      future_field: "some_value",
      another_new_field: 123,
    });
    const event = parseCursorEvent(line) as CursorResultEvent;
    expect(event).not.toBeNull();
    expect(event.subtype).toBe("success");
    expect(event.result).toBe("Done");
    // Extra fields are passed through (type assertion doesn't strip them)
    expect((event as any).future_field).toBe("some_value");
  });

  test("handles unicode content", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello 世界 🌍 مرحبا мир" }],
      },
      session_id: "sess_unicode",
    });
    const event = parseCursorEvent(line) as CursorAssistantEvent;
    expect(event).not.toBeNull();
    expect(event.message.content[0].text).toBe("Hello 世界 🌍 مرحبا мир");
  });

  test("handles empty content array in assistant event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [],
      },
      session_id: "sess_empty",
    });
    const event = parseCursorEvent(line) as CursorAssistantEvent;
    expect(event).not.toBeNull();
    expect(event.message.content).toHaveLength(0);
  });

  test("handles long result text", () => {
    const longText = "x".repeat(100_000);
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: longText,
    });
    const event = parseCursorEvent(line) as CursorResultEvent;
    expect(event).not.toBeNull();
    expect(event.result!.length).toBe(100_000);
  });
});

// ── Session Liveness Tracking ───────────────────────────────────

describe("Cursor session liveness tracking", () => {
  const sessionId = "cursor_sess_001";

  beforeEach(() => {
    markSessionDead(sessionId);
  });

  test("unknown session is not alive", async () => {
    expect(await isSessionAlive("cursor_nonexistent")).toBe(false);
  });

  test("markSessionAlive makes session alive", async () => {
    markSessionAlive(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(true);
  });

  test("markSessionDead makes session not alive", async () => {
    markSessionAlive(sessionId);
    markSessionDead(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(false);
  });

  test("sessions are isolated from each other", async () => {
    const other = "cursor_other_001";
    markSessionDead(other);

    markSessionAlive(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(true);
    expect(await isSessionAlive(other)).toBe(false);

    markSessionDead(other);
  });

  test("multiple sessions can be alive simultaneously", async () => {
    const ids = ["cursor_a", "cursor_b", "cursor_c"];
    for (const id of ids) markSessionAlive(id);

    for (const id of ids) {
      expect(await isSessionAlive(id)).toBe(true);
    }

    for (const id of ids) markSessionDead(id);
  });

  test("markSessionAlive is idempotent", async () => {
    markSessionAlive(sessionId);
    markSessionAlive(sessionId);
    markSessionAlive(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(true);
  });

  test("markSessionDead is idempotent", async () => {
    markSessionDead(sessionId);
    markSessionDead(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(false);
  });

  test("revival after death", async () => {
    markSessionAlive(sessionId);
    markSessionDead(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(false);

    markSessionAlive(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(true);
  });

  test("empty string session ID", async () => {
    markSessionAlive("");
    expect(await isSessionAlive("")).toBe(true);
    markSessionDead("");
  });

  test("UUID-style session ID", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    markSessionAlive(uuid);
    expect(await isSessionAlive(uuid)).toBe(true);
    markSessionDead(uuid);
  });
});

// ── Session Busy Tracking ───────────────────────────────────────

describe("Cursor session busy tracking", () => {
  const sessionId = "cursor_busy_test";

  beforeEach(() => {
    markSessionDead(sessionId);
  });

  test("unknown session is not busy", async () => {
    expect(await isSessionBusy("cursor_unknown")).toBe(false);
  });

  test("alive session is not automatically busy", async () => {
    markSessionAlive(sessionId);
    expect(await isSessionBusy(sessionId)).toBe(false);
  });

  test("markSessionDead clears busy state", async () => {
    markSessionAlive(sessionId);
    markSessionDead(sessionId);
    expect(await isSessionBusy(sessionId)).toBe(false);
  });

  test("alive does not imply busy and vice versa", async () => {
    markSessionAlive(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(true);
    expect(await isSessionBusy(sessionId)).toBe(false);
  });
});

// ── Session Metadata ────────────────────────────────────────────

describe("Cursor session metadata", () => {
  const sessionId = "cursor_meta_test";

  beforeEach(() => {
    markSessionDead(sessionId);
  });

  test("returns undefined for unknown session", () => {
    expect(getCursorSessionMeta("cursor_no_meta")).toBeUndefined();
  });

  test("stores and retrieves project path", () => {
    setCursorSessionMeta(sessionId, { projectPath: "/home/user/project" });
    const meta = getCursorSessionMeta(sessionId);
    expect(meta).toBeDefined();
    expect(meta!.projectPath).toBe("/home/user/project");
  });

  test("overwrites existing metadata", () => {
    setCursorSessionMeta(sessionId, { projectPath: "/old/path" });
    setCursorSessionMeta(sessionId, { projectPath: "/new/path" });
    expect(getCursorSessionMeta(sessionId)!.projectPath).toBe("/new/path");
  });

  test("markSessionDead clears metadata", () => {
    setCursorSessionMeta(sessionId, { projectPath: "/project" });
    markSessionDead(sessionId);
    expect(getCursorSessionMeta(sessionId)).toBeUndefined();
  });

  test("metadata is isolated per session", () => {
    const other = "cursor_meta_other";
    setCursorSessionMeta(sessionId, { projectPath: "/path/a" });
    setCursorSessionMeta(other, { projectPath: "/path/b" });

    expect(getCursorSessionMeta(sessionId)!.projectPath).toBe("/path/a");
    expect(getCursorSessionMeta(other)!.projectPath).toBe("/path/b");

    markSessionDead(other);
  });

  test("Windows-style path", () => {
    setCursorSessionMeta(sessionId, { projectPath: "C:\\Users\\Dev\\project" });
    expect(getCursorSessionMeta(sessionId)!.projectPath).toBe("C:\\Users\\Dev\\project");
  });
});

// ── CLI Discovery Cache ─────────────────────────────────────────

describe("CLI discovery cache", () => {
  test("resetCliCache does not throw", () => {
    expect(() => resetCliCache()).not.toThrow();
  });

  test("resetCliCache can be called multiple times", () => {
    resetCliCache();
    resetCliCache();
    resetCliCache();
    // No error — idempotent
  });
});

// ── Event Type Discrimination ───────────────────────────────────

describe("CursorEvent type discrimination", () => {
  test("system event narrows correctly", () => {
    const event: CursorEvent = {
      type: "system",
      subtype: "init",
      session_id: "sess_001",
    };
    if (event.type === "system") {
      expect(event.subtype).toBe("init");
      expect(event.session_id).toBe("sess_001");
    }
  });

  test("assistant event narrows correctly", () => {
    const event: CursorEvent = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
      session_id: "sess_001",
    };
    if (event.type === "assistant") {
      expect(event.message.content[0].text).toBe("Hello");
    }
  });

  test("result event narrows correctly", () => {
    const event: CursorEvent = {
      type: "result",
      subtype: "success",
      result: "Done",
      duration_ms: 1234,
    };
    if (event.type === "result") {
      expect(event.subtype).toBe("success");
      expect(event.result).toBe("Done");
      expect(event.duration_ms).toBe(1234);
    }
  });

  test("tool_call event narrows correctly", () => {
    const event: CursorEvent = {
      type: "tool_call",
      subtype: "started",
      call_id: "call_001",
    };
    if (event.type === "tool_call") {
      expect(event.subtype).toBe("started");
      expect(event.call_id).toBe("call_001");
    }
  });

  test("user event narrows correctly", () => {
    const event: CursorEvent = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Fix it" }],
      },
    };
    if (event.type === "user") {
      expect(event.message.content[0].text).toBe("Fix it");
    }
  });

  test("event type routing simulation", () => {
    const events: CursorEvent[] = [
      { type: "system", subtype: "init", session_id: "sess_001" },
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Hello" }] },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi" }],
        },
        session_id: "sess_001",
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: " there" }],
        },
        session_id: "sess_001",
      },
      { type: "tool_call", subtype: "started", call_id: "c1" },
      { type: "tool_call", subtype: "completed", call_id: "c1" },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "!" }],
        },
        session_id: "sess_001",
      },
      {
        type: "result",
        subtype: "success",
        result: "Hi there!",
        duration_ms: 2000,
      },
    ];

    let sessionId = "";
    const textDeltas: string[] = [];
    let finalResult = "";
    let toolCallCount = 0;

    for (const event of events) {
      switch (event.type) {
        case "system":
          sessionId = event.session_id;
          break;
        case "assistant":
          for (const block of event.message.content) {
            if (block.type === "text") textDeltas.push(block.text);
          }
          break;
        case "tool_call":
          if (event.subtype === "started") toolCallCount++;
          break;
        case "result":
          finalResult = event.result ?? "";
          break;
      }
    }

    expect(sessionId).toBe("sess_001");
    expect(textDeltas).toEqual(["Hi", " there", "!"]);
    expect(toolCallCount).toBe(1);
    expect(finalResult).toBe("Hi there!");
  });
});

// ── Lifecycle Simulation ────────────────────────────────────────

describe("Cursor session lifecycle simulation", () => {
  test("registration → alive → invocation pattern", async () => {
    const sessionId = "cursor_lifecycle_001";
    markSessionDead(sessionId);

    // Before registration: ghost
    expect(await isSessionAlive(sessionId)).toBe(false);
    expect(await isSessionBusy(sessionId)).toBe(false);

    // Registration: mark alive + set metadata
    markSessionAlive(sessionId);
    setCursorSessionMeta(sessionId, { projectPath: "/project" });
    expect(await isSessionAlive(sessionId)).toBe(true);
    expect(await isSessionBusy(sessionId)).toBe(false);
    expect(getCursorSessionMeta(sessionId)!.projectPath).toBe("/project");

    // Cleanup
    markSessionDead(sessionId);
  });

  test("registration → dead → ghost → re-register", async () => {
    const sessionId = "cursor_lifecycle_002";
    markSessionDead(sessionId);

    // Register
    markSessionAlive(sessionId);
    setCursorSessionMeta(sessionId, { projectPath: "/old" });
    expect(await isSessionAlive(sessionId)).toBe(true);

    // Process dies — mark dead (clears metadata)
    markSessionDead(sessionId);
    expect(await isSessionAlive(sessionId)).toBe(false);
    expect(getCursorSessionMeta(sessionId)).toBeUndefined();

    // Agent re-registers with new session
    const newSessionId = "cursor_lifecycle_002_new";
    markSessionAlive(newSessionId);
    setCursorSessionMeta(newSessionId, { projectPath: "/new" });
    expect(await isSessionAlive(newSessionId)).toBe(true);
    expect(await isSessionAlive(sessionId)).toBe(false);
    expect(getCursorSessionMeta(newSessionId)!.projectPath).toBe("/new");

    // Cleanup
    markSessionDead(newSessionId);
  });

  test("multiple independent lifecycles", async () => {
    const agents = ["cursor_agent_a", "cursor_agent_b", "cursor_agent_c"];
    for (const id of agents) markSessionDead(id);

    // All register
    for (const id of agents) {
      markSessionAlive(id);
      setCursorSessionMeta(id, { projectPath: `/project/${id}` });
    }
    for (const id of agents) {
      expect(await isSessionAlive(id)).toBe(true);
    }

    // Agent B dies
    markSessionDead(agents[1]);
    expect(await isSessionAlive(agents[0])).toBe(true);
    expect(await isSessionAlive(agents[1])).toBe(false);
    expect(await isSessionAlive(agents[2])).toBe(true);
    expect(getCursorSessionMeta(agents[1])).toBeUndefined();

    // Agent B re-registers
    markSessionAlive(agents[1]);
    setCursorSessionMeta(agents[1], { projectPath: "/project/new_b" });
    for (const id of agents) {
      expect(await isSessionAlive(id)).toBe(true);
    }

    // Cleanup
    for (const id of agents) markSessionDead(id);
  });

  test("rapid state toggling (100 iterations)", async () => {
    const sessionId = "cursor_rapid_toggle";
    markSessionDead(sessionId);

    for (let i = 0; i < 100; i++) {
      markSessionAlive(sessionId);
      expect(await isSessionAlive(sessionId)).toBe(true);
      markSessionDead(sessionId);
      expect(await isSessionAlive(sessionId)).toBe(false);
    }
  });
});

// ── Broadcaster Event Integration ───────────────────────────────

describe("Cursor broadcaster event shapes", () => {
  test("agentStreamingEvent for Cursor agent", () => {
    const event = agentStreamingEvent("cursor-agent", "#general", "Hello from Cursor");
    expect(event.type).toBe("agent_streaming");
    expect(event.data).toEqual({
      agent_name: "cursor-agent",
      channel_id: "#general",
      delta: "Hello from Cursor",
    });
  });

  test("agentStreamingEvent with empty delta", () => {
    const event = agentStreamingEvent("cursor-agent", "#project", "");
    expect(event.data.delta).toBe("");
  });

  test("agentTypingEvent start for Cursor agent", () => {
    const event = agentTypingEvent("cursor-agent", "#general", true);
    expect(event.type).toBe("agent_typing");
    expect(event.data).toEqual({
      agent_name: "cursor-agent",
      channel_id: "#general",
      is_typing: true,
    });
  });

  test("agentTypingEvent stop with error for Cursor agent", () => {
    const event = agentTypingEvent("cursor-agent", "#general", false, "CLI not found");
    expect(event.data.is_typing).toBe(false);
    expect(event.data.error).toBe("CLI not found");
  });
});

// ── NDJSON Stream Simulation ────────────────────────────────────

describe("NDJSON stream simulation", () => {
  test("full stream sequence: system → user → assistant deltas → tool_call → result", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess_stream" }),
      JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "Fix the bug" }] } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "I'll" }] }, session_id: "sess_stream" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: " look" }] }, session_id: "sess_stream" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: " into it" }] }, session_id: "sess_stream" }),
      JSON.stringify({ type: "tool_call", subtype: "started", call_id: "call_001" }),
      JSON.stringify({ type: "tool_call", subtype: "completed", call_id: "call_001" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: ". Fixed!" }] }, session_id: "sess_stream" }),
      JSON.stringify({ type: "result", subtype: "success", result: "I'll look into it. Fixed!", duration_ms: 3500 }),
    ];

    const events = lines.map((l) => parseCursorEvent(l)).filter(Boolean) as CursorEvent[];
    expect(events).toHaveLength(9);

    // Verify event order
    expect(events[0].type).toBe("system");
    expect(events[1].type).toBe("user");
    expect(events[2].type).toBe("assistant");
    expect(events[3].type).toBe("assistant");
    expect(events[4].type).toBe("assistant");
    expect(events[5].type).toBe("tool_call");
    expect(events[6].type).toBe("tool_call");
    expect(events[7].type).toBe("assistant");
    expect(events[8].type).toBe("result");

    // Collect text deltas
    const deltas: string[] = [];
    for (const event of events) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text") deltas.push(block.text);
        }
      }
    }
    expect(deltas.join("")).toBe("I'll look into it. Fixed!");

    // Final result matches
    const result = events[8] as CursorResultEvent;
    expect(result.result).toBe("I'll look into it. Fixed!");
    expect(result.duration_ms).toBe(3500);
  });

  test("stream with mixed valid and invalid lines", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess_mixed" }),
      "not json at all",
      "",
      JSON.stringify({ type: "unknown_type", data: "ignored" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Ok" }] }, session_id: "sess_mixed" }),
      "   ",
      JSON.stringify({ type: "result", subtype: "success", result: "Ok" }),
    ];

    const events = lines.map((l) => parseCursorEvent(l)).filter(Boolean) as CursorEvent[];
    // Only system, assistant, and result should parse successfully
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("system");
    expect(events[1].type).toBe("assistant");
    expect(events[2].type).toBe("result");
  });

  test("error result stream", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess_err" }),
      JSON.stringify({ type: "result", subtype: "error", is_error: true, result: "API rate limited" }),
    ];

    const events = lines.map((l) => parseCursorEvent(l)).filter(Boolean) as CursorEvent[];
    expect(events).toHaveLength(2);
    const result = events[1] as CursorResultEvent;
    expect(result.subtype).toBe("error");
    expect(result.is_error).toBe(true);
    expect(result.result).toBe("API rate limited");
  });
});
