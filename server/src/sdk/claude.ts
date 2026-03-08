/**
 * Claude Code SDK wrapper.
 *
 * Provides the same semantic interface as opencode.ts for session management,
 * invocation, and streaming — adapted for the Claude Agent SDK's subprocess
 * model (vs OpenCode's REST client-server model).
 *
 * Key differences from OpenCode:
 * - No server URL — Claude runs as a subprocess via query()
 * - Session liveness tracked locally (no REST health endpoint)
 * - Busy state tracked via in-process Set (no status API)
 * - Streaming via async generator messages (not SSE)
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  SDKMessage,
  SDKResultMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  Query,
} from "@anthropic-ai/claude-agent-sdk";

// Re-export useful types for consumers
export type {
  SDKMessage,
  SDKResultMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  Query,
};

// Default timeout for prompt calls (10 minutes — matches opencode.ts)
const PROMPT_TIMEOUT_MS = 600_000;

export interface ClaudeSessionRecord {
  sessionId: string;
  cwd: string | null;
  filePath: string;
}

type ClaudeQueryOptions = {
  resume: string;
  abortController: AbortController;
  permissionMode: "bypassPermissions";
  allowDangerouslySkipPermissions: true;
  cwd?: string;
  includePartialMessages?: boolean;
};

export function buildClaudeQueryOptions(opts: {
  sessionId: string;
  abortController: AbortController;
  cwd?: string;
  includePartialMessages?: boolean;
}): ClaudeQueryOptions {
  return {
    resume: opts.sessionId,
    abortController: opts.abortController,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    ...(opts.includePartialMessages ? { includePartialMessages: true } : {}),
  };
}

function normalizeComparablePath(value: string): string {
  const normalized = path.normalize(value).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function getClaudeProjectsRoot(homeDir: string = os.homedir()): string {
  return process.env.TALKTO_CLAUDE_PROJECTS_DIR ?? path.join(homeDir, ".claude", "projects");
}

function walkJsonlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonlFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(entryPath);
    }
  }
  return files;
}

function readFirstLine(filePath: string): string | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    if (!raw) return null;
    const newline = raw.indexOf("\n");
    return newline === -1 ? raw.trim() : raw.slice(0, newline).trim();
  } catch {
    return null;
  }
}

export function readClaudeSessionIndex(
  rootDir: string = getClaudeProjectsRoot()
): Map<string, ClaudeSessionRecord[]> {
  const records = new Map<string, ClaudeSessionRecord[]>();

  for (const filePath of walkJsonlFiles(rootDir)) {
    const firstLine = readFirstLine(filePath);
    if (!firstLine) continue;

    try {
      const parsed = JSON.parse(firstLine) as {
        sessionId?: unknown;
        cwd?: unknown;
      };
      if (typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
        continue;
      }

      const record: ClaudeSessionRecord = {
        sessionId: parsed.sessionId,
        cwd: typeof parsed.cwd === "string" ? parsed.cwd : null,
        filePath,
      };
      const existing = records.get(record.sessionId) ?? [];
      existing.push(record);
      records.set(record.sessionId, existing);
    } catch {
      continue;
    }
  }

  return records;
}

export function hasRecoverableClaudeSession(
  sessionId: string,
  projectPath: string,
  index: Map<string, ClaudeSessionRecord[]> = readClaudeSessionIndex()
): boolean {
  const records = index.get(sessionId);
  if (!records?.length) return false;

  const normalizedProjectPath = normalizeComparablePath(projectPath);
  return records.some((record) =>
    record.cwd ? normalizeComparablePath(record.cwd) === normalizedProjectPath : false
  );
}

// ---------------------------------------------------------------------------
// Session state tracking — in-process (no REST API available)
// ---------------------------------------------------------------------------

/**
 * Set of session IDs that are currently being prompted.
 * Since Claude runs as subprocesses, there's no REST status endpoint.
 * We track busy state locally.
 */
const busySessions = new Set<string>();

/**
 * Set of session IDs known to be alive in the current server process.
 * Registration verification and successful prompts repopulate this cache.
 */
const knownAliveSessions = new Set<string>();

/**
 * Mark a session as known-alive (e.g., after successful registration or prompt).
 */
export function markSessionAlive(sessionId: string): void {
  knownAliveSessions.add(sessionId);
}

/**
 * Mark a session as dead (e.g., after failed prompt or deregistration).
 */
export function markSessionDead(sessionId: string): void {
  knownAliveSessions.delete(sessionId);
  busySessions.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Session operations — mirror opencode.ts interface
// ---------------------------------------------------------------------------

/**
 * Check if a Claude Code session is alive.
 *
 * Since Claude has no REST API for session lookups, we rely on local tracking.
 * A session is considered alive if it was successfully registered or has
 * completed a prompt since the last TalkTo restart.
 */
export async function isSessionAlive(sessionId: string): Promise<boolean> {
  return knownAliveSessions.has(sessionId);
}

/**
 * Check if a Claude Code session is currently busy (processing a prompt).
 */
export async function isSessionBusy(sessionId: string): Promise<boolean> {
  return busySessions.has(sessionId);
}

// ---------------------------------------------------------------------------
// Invocation — send a prompt to an agent's Claude Code session
// ---------------------------------------------------------------------------

/**
 * Send a prompt to a Claude Code session and wait for the response.
 *
 * Uses the Claude Agent SDK's query() function which spawns a subprocess.
 * The session is resumed by ID so the agent retains conversation history.
 *
 * Includes a timeout (default 10 minutes) as a safety net.
 */
export async function promptSession(
  sessionId: string,
  text: string,
  cwd?: string,
  timeoutMs: number = PROMPT_TIMEOUT_MS
): Promise<{ text: string; cost: number; tokens: { input: number; output: number } } | null> {
  busySessions.add(sessionId);

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    const conversation = query({
      prompt: text,
      options: buildClaudeQueryOptions({
        sessionId,
        abortController,
        cwd,
      }),
    });

    let result: { text: string; cost: number; tokens: { input: number; output: number } } | null = null;

    try {
      for await (const message of conversation) {
        if (message.type === "result") {
          const resultMsg = message as SDKResultMessage;
          if (resultMsg.subtype === "success") {
            const success = resultMsg as SDKResultSuccess;
            result = {
              text: success.result,
              cost: success.total_cost_usd ?? 0,
              tokens: {
                input: success.usage?.input_tokens ?? 0,
                output: success.usage?.output_tokens ?? 0,
              },
            };
          } else {
            const error = resultMsg as SDKResultError;
            console.error(
              `[CLAUDE] Session ${sessionId} returned error: ${error.subtype}`,
              error.errors?.join(", ") ?? ""
            );
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (result) {
      markSessionAlive(sessionId);
    }

    return result;
  } catch (err) {
    markSessionDead(sessionId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[CLAUDE] Prompt timed out after ${timeoutMs}ms for session ${sessionId}`);
    } else {
      console.error(`[CLAUDE] Failed to prompt session ${sessionId}:`, err);
    }
    return null;
  } finally {
    busySessions.delete(sessionId);
  }
}

/**
 * Prompt a session with real-time event callbacks.
 *
 * Like promptSession() but accepts callbacks that fire as streaming events
 * arrive during processing. This enables real-time typing indicators
 * and streaming text in the TalkTo UI.
 *
 * Uses query() with includePartialMessages:true to get stream_event messages
 * containing text deltas.
 *
 * @param onTypingStart - Called when the session starts processing
 * @param onTextDelta - Called with incremental text as the agent generates it
 * @param onComplete - Called when the session finishes
 * @param onError - Called if the session encounters an error
 */
export async function promptSessionWithEvents(
  sessionId: string,
  text: string,
  callbacks: {
    onTypingStart?: () => void;
    onTextDelta?: (delta: string) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
  } = {},
  cwd?: string,
  timeoutMs: number = PROMPT_TIMEOUT_MS
): Promise<{ text: string; cost: number; tokens: { input: number; output: number } } | null> {
  busySessions.add(sessionId);

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    const conversation = query({
      prompt: text,
      options: buildClaudeQueryOptions({
        sessionId,
        abortController,
        cwd,
        includePartialMessages: true,
      }),
    });

    let result: { text: string; cost: number; tokens: { input: number; output: number } } | null = null;
    let typingStarted = false;

    try {
      for await (const message of conversation) {
        switch (message.type) {
          case "system": {
            // Init message — session has started
            const sysMsg = message as SDKSystemMessage;
            if (sysMsg.subtype === "init" && !typingStarted) {
              typingStarted = true;
              callbacks.onTypingStart?.();
            }
            break;
          }

          case "assistant": {
            // Full assistant message — typing has started
            if (!typingStarted) {
              typingStarted = true;
              callbacks.onTypingStart?.();
            }
            break;
          }

          case "stream_event": {
            // Streaming text delta from partial messages
            if (!typingStarted) {
              typingStarted = true;
              callbacks.onTypingStart?.();
            }
            const streamEvent = message as SDKPartialAssistantMessage;
            const event = streamEvent.event;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              callbacks.onTextDelta?.(event.delta.text);
            }
            break;
          }

          case "result": {
            const resultMsg = message as SDKResultMessage;
            if (resultMsg.subtype === "success") {
              const success = resultMsg as SDKResultSuccess;
              result = {
                text: success.result,
                cost: success.total_cost_usd ?? 0,
                tokens: {
                  input: success.usage?.input_tokens ?? 0,
                  output: success.usage?.output_tokens ?? 0,
                },
              };
            } else {
              const error = resultMsg as SDKResultError;
              const errorMsg = error.errors?.join(", ") ?? error.subtype;
              console.error(`[CLAUDE] Session ${sessionId} error: ${errorMsg}`);
              callbacks.onError?.(errorMsg);
            }
            callbacks.onComplete?.();
            break;
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (result) {
      markSessionAlive(sessionId);
    }

    return result;
  } catch (err) {
    markSessionDead(sessionId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[CLAUDE] Prompt timed out after ${timeoutMs}ms for session ${sessionId}`);
      callbacks.onError?.(`Prompt timed out after ${timeoutMs}ms`);
    } else {
      console.error(`[CLAUDE] Failed promptWithEvents for ${sessionId}:`, err);
      callbacks.onError?.(err instanceof Error ? err.message : "Unknown error");
    }
    return null;
  } finally {
    busySessions.delete(sessionId);
  }
}

/**
 * Extract text from a Claude SDK result message.
 * The result.result field already contains the extracted text response.
 */
export function extractTextFromResult(result: SDKResultSuccess): string {
  return result.result?.trim() ?? "";
}
