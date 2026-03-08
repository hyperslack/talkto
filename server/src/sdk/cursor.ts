/**
 * Cursor CLI SDK wrapper — Phase 2 (bidirectional invocation via subprocess).
 *
 * Spawns the standalone Cursor CLI (`agent`) in headless mode to process
 * prompts and stream responses back to TalkTo channels, matching the
 * interface exposed by claude.ts and codex.ts.
 *
 * The Cursor CLI is invoked with:
 *   agent -p --output-format stream-json --stream-partial-output
 *     --resume <sessionId> --force --trust --workspace <projectPath>
 *     [--api-key <key>] "prompt text"
 *
 * NDJSON event types: system(init) → user → assistant(deltas) → tool_call → result
 *
 * Auth: stored `agent login` session or CURSOR_API_KEY env var / --api-key flag.
 *
 * Key characteristics:
 * - Subprocess-based (same model as Claude Code and Codex CLI)
 * - Session resume via --resume <chatId>
 * - Streaming text deltas via --stream-partial-output
 * - No server URL — CLI is spawned locally
 * - Session liveness tracked via in-process Set (cleared on TalkTo restart)
 * - Graceful fallback: if CLI/auth is unavailable, returns null with diagnostics
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createInterface } from "node:readline";
import { config } from "../lib/config";

// ---------------------------------------------------------------------------
// NDJSON event types — Cursor CLI stream-json output format
// ---------------------------------------------------------------------------

/** System init event — emitted once at session start. */
export interface CursorSystemEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  model?: string;
  cwd?: string;
  apiKeySource?: string;
  permissionMode?: string;
}

/** Assistant message event — text content (full or delta depending on --stream-partial-output). */
export interface CursorAssistantEvent {
  type: "assistant";
  message: {
    role: "assistant";
    content: Array<{ type: "text"; text: string }>;
  };
  session_id: string;
}

/** Result event — terminal event with final text and duration. */
export interface CursorResultEvent {
  type: "result";
  subtype: string; // "success" or error variants
  is_error?: boolean;
  result?: string;
  duration_ms?: number;
  duration_api_ms?: number;
  session_id?: string;
  request_id?: string;
}

/** Tool call event (started or completed) — logged but not streamed to frontend. */
export interface CursorToolCallEvent {
  type: "tool_call";
  subtype: "started" | "completed";
  call_id?: string;
  session_id?: string;
}

/** User prompt echo event. */
export interface CursorUserEvent {
  type: "user";
  message: {
    role: "user";
    content: Array<{ type: "text"; text: string }>;
  };
  session_id?: string;
}

/** Union of all NDJSON event types from the Cursor CLI. */
export type CursorEvent =
  | CursorSystemEvent
  | CursorAssistantEvent
  | CursorResultEvent
  | CursorToolCallEvent
  | CursorUserEvent;

// ---------------------------------------------------------------------------
// NDJSON line parser
// ---------------------------------------------------------------------------

/**
 * Parse a single NDJSON line from the Cursor CLI.
 * Returns null for unparseable or unknown event types.
 * Ignores unknown fields per Cursor's backward-compatibility contract.
 */
export function parseCursorEvent(line: string): CursorEvent | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line);
    if (!obj || typeof obj.type !== "string") return null;

    switch (obj.type) {
      case "system":
        if (obj.subtype === "init") return obj as CursorSystemEvent;
        return null;
      case "assistant":
        if (obj.message?.role === "assistant" && Array.isArray(obj.message?.content)) {
          return obj as CursorAssistantEvent;
        }
        return null;
      case "result":
        return obj as CursorResultEvent;
      case "tool_call":
        return obj as CursorToolCallEvent;
      case "user":
        return obj as CursorUserEvent;
      default:
        // Unknown event type — ignore per backward-compatibility
        return null;
    }
  } catch {
    // Malformed JSON line — skip
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI binary discovery
// ---------------------------------------------------------------------------

/** Cached CLI path after first successful discovery. */
let cachedCliPath: { command: string; args: string[] } | null = null;

function inferCursorCliArgs(command: string): string[] {
  const base = path.basename(command).toLowerCase();
  return base.startsWith("cursor") && !base.startsWith("cursor-agent")
    ? ["agent"]
    : [];
}

function probeCliCandidate(
  command: string,
  args: string[] = inferCursorCliArgs(command)
): { command: string; args: string[] } | null {
  try {
    const check = spawnSync(command, [...args, "--version"], {
      encoding: "utf8",
      timeout: 5000,
    });
    if (check.status === 0) {
      return { command, args };
    }
  } catch {
    // Ignore invalid candidates and keep searching.
  }
  return null;
}

function findCliOnPath(binary: "agent" | "cursor"): { command: string; args: string[] } | null {
  const result = spawnSync(
    process.platform === "win32" ? "where" : "which",
    [binary],
    { encoding: "utf8", timeout: 5000 }
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  const candidates = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const resolved = probeCliCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function getCursorInvocationError(stderrOutput: string, exitCode: number | null): string | null {
  const stderr = stderrOutput.trim();
  if (stderr) {
    if (/authentication required/i.test(stderr)) {
      return "Cursor authentication required. Run `agent login` or set CURSOR_API_KEY.";
    }
    if (/not logged in/i.test(stderr)) {
      return "Cursor is not authenticated. Run `agent login` or set CURSOR_API_KEY.";
    }
    return stderr;
  }

  if (exitCode && exitCode !== 0) {
    return `Cursor CLI exited with code ${exitCode}.`;
  }

  return null;
}

/**
 * Discover the Cursor CLI binary.
 *
 * Priority:
 * 1. CURSOR_CLI_PATH env var (explicit override)
 * 2. Standalone `agent` binary in PATH
 * 3. Desktop `cursor` binary with `agent` subcommand (NOT usable for headless,
 *    but we detect it and use it since newer Cursor versions may support -p via this path)
 * 4. Platform-specific default locations
 *
 * Returns { command, args } where args is the prefix args (e.g., ["agent"] for `cursor agent`).
 * Returns null if no CLI found.
 */
export function findCursorCli(): { command: string; args: string[] } | null {
  if (cachedCliPath) return cachedCliPath;

  // 1. Explicit override
  if (config.cursorCliPath) {
    const explicit = probeCliCandidate(config.cursorCliPath);
    if (explicit) {
      cachedCliPath = explicit;
      return cachedCliPath;
    }
    console.warn(`[CURSOR] CURSOR_CLI_PATH is set but not usable: ${config.cursorCliPath}`);
  }

  // 2. Standalone `agent` in PATH
  const standaloneAgent = findCliOnPath("agent");
  if (standaloneAgent) {
    cachedCliPath = standaloneAgent;
    console.log(`[CURSOR] Found standalone CLI: ${standaloneAgent.command}`);
    return cachedCliPath;
  }

  // 3. Desktop `cursor` in PATH (with `agent` subcommand)
  const desktopCursor = findCliOnPath("cursor");
  if (desktopCursor) {
    cachedCliPath = desktopCursor;
    console.log(
      `[CURSOR] Found desktop CLI: ${desktopCursor.command} ${desktopCursor.args.join(" ")}`
        .trim()
    );
    return cachedCliPath;
  }

  // 4. Platform-specific default locations
  const home = os.homedir();
  const candidates: Array<{ command: string; args: string[] }> = [];

  if (process.platform === "win32") {
    candidates.push(
      { command: path.join(home, "AppData", "Local", "cursor-agent", "agent.cmd"), args: [] },
      { command: path.join(home, "AppData", "Local", "cursor-agent", "cursor-agent.cmd"), args: [] },
      { command: path.join(home, ".cursor", "bin", "agent.exe"), args: [] },
      { command: path.join(home, ".local", "bin", "agent.exe"), args: [] },
      { command: path.join(home, "AppData", "Local", "Programs", "cursor", "resources", "app", "bin", "cursor.cmd"), args: ["agent"] },
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      { command: path.join(home, ".local", "bin", "agent"), args: [] },
      { command: "/usr/local/bin/agent", args: [] },
      { command: path.join(home, ".cursor", "bin", "agent"), args: [] },
    );
  } else {
    candidates.push(
      { command: path.join(home, ".local", "bin", "agent"), args: [] },
      { command: path.join(home, ".cursor", "bin", "agent"), args: [] },
    );
  }

  for (const candidate of candidates) {
    const resolved = probeCliCandidate(candidate.command, candidate.args);
    if (resolved) {
      cachedCliPath = resolved;
      console.log(`[CURSOR] Found CLI at: ${candidate.command} ${candidate.args.join(" ")}`.trim());
      return cachedCliPath;
    }
  }

  console.warn("[CURSOR] CLI not found. Install via: irm 'https://cursor.com/install?win32=true' | iex (Windows) or curl https://cursor.com/install -fsS | bash (macOS/Linux)");
  return null;
}

/** Reset the cached CLI path (for testing). */
export function resetCliCache(): void {
  cachedCliPath = null;
}

export function getCursorProjectsRoot(homeDir: string = os.homedir()): string {
  return process.env.TALKTO_CURSOR_PROJECTS_DIR ?? path.join(homeDir, ".cursor", "projects");
}

export function encodeCursorProjectPath(projectPath: string): string {
  const normalized = path.normalize(projectPath).replace(/[\\/]+$/, "");
  const unixy = normalized.replace(/\\/g, "/");
  const driveMatch = unixy.match(/^([A-Za-z]):\/(.*)$/);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    return `${drive.toLowerCase()}-${rest.replace(/[/:]+/g, "-")}`;
  }
  return unixy.replace(/^\/+/, "").replace(/[/:]+/g, "-");
}

export function readCursorSessionIndex(
  rootDir: string = getCursorProjectsRoot()
): Map<string, Set<string>> {
  const sessions = new Map<string, Set<string>>();
  if (!existsSync(rootDir)) return sessions;

  for (const projectDir of readdirSync(rootDir, { withFileTypes: true })) {
    if (!projectDir.isDirectory()) continue;

    const transcriptsDir = path.join(rootDir, projectDir.name, "agent-transcripts");
    if (!existsSync(transcriptsDir)) continue;

    for (const sessionDir of readdirSync(transcriptsDir, { withFileTypes: true })) {
      if (!sessionDir.isDirectory()) continue;

      const sessionId = sessionDir.name;
      const transcriptPath = path.join(transcriptsDir, sessionId, `${sessionId}.jsonl`);
      if (!existsSync(transcriptPath)) continue;

      const projects = sessions.get(sessionId) ?? new Set<string>();
      projects.add(projectDir.name);
      sessions.set(sessionId, projects);
    }
  }

  return sessions;
}

export function hasRecoverableCursorSession(
  sessionId: string,
  projectPath: string,
  sessionIndex: Map<string, Set<string>> = readCursorSessionIndex()
): boolean {
  const projectKeys = sessionIndex.get(sessionId);
  if (!projectKeys?.size) return false;

  const expectedProjectKey = encodeCursorProjectPath(projectPath);
  return projectKeys.has(expectedProjectKey) || projectKeys.size === 1;
}

// ---------------------------------------------------------------------------
// Session state tracking — in-process (same as Claude Code and Codex)
// ---------------------------------------------------------------------------

/** Sessions currently being prompted. */
const busySessions = new Set<string>();

/** Sessions known to be alive in the current server process. */
const knownAliveSessions = new Set<string>();

/** Per-session metadata (project path, etc.). */
const sessionMeta = new Map<string, { projectPath: string }>();

export function markSessionAlive(sessionId: string): void {
  knownAliveSessions.add(sessionId);
}

export function markSessionDead(sessionId: string): void {
  knownAliveSessions.delete(sessionId);
  busySessions.delete(sessionId);
  sessionMeta.delete(sessionId);
}

export async function isSessionAlive(sessionId: string): Promise<boolean> {
  return knownAliveSessions.has(sessionId);
}

export async function isSessionBusy(sessionId: string): Promise<boolean> {
  return busySessions.has(sessionId);
}

/** Store metadata for a Cursor session (called during registration). */
export function setCursorSessionMeta(sessionId: string, meta: { projectPath: string }): void {
  sessionMeta.set(sessionId, meta);
}

/** Get metadata for a Cursor session. */
export function getCursorSessionMeta(sessionId: string): { projectPath: string } | undefined {
  return sessionMeta.get(sessionId);
}

// ---------------------------------------------------------------------------
// Prompt timeout
// ---------------------------------------------------------------------------

const PROMPT_TIMEOUT_MS = 600_000; // 10 minutes

// ---------------------------------------------------------------------------
// promptSession() — basic (non-streaming) invocation
// ---------------------------------------------------------------------------

/**
 * Send a prompt to a Cursor agent and wait for the complete response.
 *
 * Spawns the Cursor CLI in headless mode, reads NDJSON from stdout,
 * and extracts the final result text.
 */
export async function promptSession(
  sessionId: string,
  text: string,
  timeoutMs: number = PROMPT_TIMEOUT_MS
): Promise<{ text: string; cost: number; tokens: { input: number; output: number } } | null> {
  const cli = findCursorCli();
  if (!cli) {
    console.error("[CURSOR] Cannot prompt: CLI not found");
    return null;
  }

  busySessions.add(sessionId);

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const meta = sessionMeta.get(sessionId);
      const args = buildCliArgs(cli.args, {
        prompt: text,
        sessionId,
        workspacePath: meta?.projectPath,
        streamPartialOutput: false,
      });

      const env: Record<string, string> = { ...process.env as Record<string, string> };
      if (config.cursorApiKey) env.CURSOR_API_KEY = config.cursorApiKey;

      const child = spawn(cli.command, args, {
        env,
        cwd: meta?.projectPath ?? process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        signal: abortController.signal,
      });

      let result: { text: string; cost: number; tokens: { input: number; output: number } } | null = null;
      let stderrOutput = "";
      let exitCode: number | null = null;

      // Collect stderr for error reporting
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      // Read NDJSON from stdout
      const rl = createInterface({ input: child.stdout });

      for await (const line of rl) {
        const event = parseCursorEvent(line);
        if (!event) continue;

        if (event.type === "result") {
          const resultEvent = event as CursorResultEvent;
          if (resultEvent.subtype === "success" && resultEvent.result) {
            result = {
              text: resultEvent.result.trim(),
              cost: 0, // Cursor CLI doesn't expose cost
              tokens: { input: 0, output: 0 }, // Not exposed in NDJSON
            };
          } else if (resultEvent.subtype !== "success") {
            console.error(
              `[CURSOR] Session ${sessionId} returned error: ${resultEvent.subtype}`,
              resultEvent.result ?? ""
            );
          }
        }
      }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        child.on("close", (code) => {
          exitCode = code;
          resolve();
        });
        child.on("error", () => resolve());
      });

      if (stderrOutput.trim()) {
        console.warn(`[CURSOR] stderr for session ${sessionId}: ${stderrOutput.trim()}`);
      }

      if (result) {
        markSessionAlive(sessionId);
      } else {
        const errorMsg = getCursorInvocationError(stderrOutput, exitCode);
        if (errorMsg) {
          console.error(`[CURSOR] Session ${sessionId} failed: ${errorMsg}`);
        }
      }

      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[CURSOR] Session ${sessionId} timed out after ${timeoutMs}ms`);
    } else {
      console.error(`[CURSOR] Error prompting session ${sessionId}:`, err);
    }
    return null;
  } finally {
    busySessions.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// promptSessionWithEvents() — streaming invocation with callbacks
// ---------------------------------------------------------------------------

/**
 * Send a prompt to a Cursor agent with real-time streaming callbacks.
 *
 * Spawns the Cursor CLI with --stream-partial-output for character-level
 * text deltas. Fires callbacks matching the TalkTo agent invoker interface.
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
  timeoutMs: number = PROMPT_TIMEOUT_MS
): Promise<{ text: string; cost: number; tokens: { input: number; output: number } } | null> {
  const cli = findCursorCli();
  if (!cli) {
    console.error("[CURSOR] Cannot prompt: CLI not found");
    callbacks.onError?.("Cursor CLI not found. Install via https://cursor.com/install");
    callbacks.onComplete?.();
    return null;
  }

  busySessions.add(sessionId);

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const meta = sessionMeta.get(sessionId);
      const args = buildCliArgs(cli.args, {
        prompt: text,
        sessionId,
        workspacePath: meta?.projectPath,
        streamPartialOutput: true,
      });

      const env: Record<string, string> = { ...process.env as Record<string, string> };
      if (config.cursorApiKey) env.CURSOR_API_KEY = config.cursorApiKey;

      const child = spawn(cli.command, args, {
        env,
        cwd: meta?.projectPath ?? process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        signal: abortController.signal,
      });

      let result: { text: string; cost: number; tokens: { input: number; output: number } } | null = null;
      let typingStarted = false;
      let stderrOutput = "";
      let exitCode: number | null = null;
      let completed = false;

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      const rl = createInterface({ input: child.stdout });

      for await (const line of rl) {
        const event = parseCursorEvent(line);
        if (!event) continue;

        switch (event.type) {
          case "system": {
            // Session initialized — fire typing start
            if (!typingStarted) {
              typingStarted = true;
              callbacks.onTypingStart?.();
            }
            break;
          }

          case "assistant": {
            // With --stream-partial-output: small text deltas
            // Without: complete message between tool calls
            if (!typingStarted) {
              typingStarted = true;
              callbacks.onTypingStart?.();
            }
            const assistantEvent = event as CursorAssistantEvent;
            for (const block of assistantEvent.message.content) {
              if (block.type === "text" && block.text) {
                callbacks.onTextDelta?.(block.text);
              }
            }
            break;
          }

          case "result": {
            const resultEvent = event as CursorResultEvent;
            if (resultEvent.subtype === "success" && resultEvent.result) {
              result = {
                text: resultEvent.result.trim(),
                cost: 0,
                tokens: { input: 0, output: 0 },
              };
            } else if (resultEvent.subtype !== "success") {
              const errorMsg = resultEvent.result ?? resultEvent.subtype;
              console.error(`[CURSOR] Session ${sessionId} error: ${errorMsg}`);
              callbacks.onError?.(errorMsg);
            }
            completed = true;
            callbacks.onComplete?.();
            break;
          }

          case "tool_call":
          case "user":
            // Tool calls and user echoes — no callback needed
            break;
        }
      }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        child.on("close", (code) => {
          exitCode = code;
          resolve();
        });
        child.on("error", () => resolve());
      });

      if (stderrOutput.trim()) {
        console.warn(`[CURSOR] stderr for session ${sessionId}: ${stderrOutput.trim()}`);
      }

      if (result) {
        markSessionAlive(sessionId);
      } else {
        const errorMsg = getCursorInvocationError(stderrOutput, exitCode);
        if (errorMsg) {
          callbacks.onError?.(errorMsg);
        }
        if (!completed) {
          callbacks.onComplete?.();
        }
      }

      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[CURSOR] Session ${sessionId} timed out after ${timeoutMs}ms`);
      callbacks.onError?.(`Cursor agent timed out after ${timeoutMs / 1000}s`);
    } else {
      console.error(`[CURSOR] Error prompting session ${sessionId}:`, err);
      callbacks.onError?.(err instanceof Error ? err.message : String(err));
    }
    callbacks.onComplete?.();
    return null;
  } finally {
    busySessions.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// CLI argument builder
// ---------------------------------------------------------------------------

/**
 * Build CLI arguments for a Cursor agent invocation.
 *
 * Constructs the full argument list for the Cursor CLI in headless mode.
 * The prompt text is passed as the last positional argument.
 */
function buildCliArgs(
  prefixArgs: string[],
  opts: {
    prompt: string;
    sessionId?: string;
    workspacePath?: string;
    streamPartialOutput?: boolean;
  }
): string[] {
  const args = [...prefixArgs];

  // Headless mode
  args.push("-p");
  args.push("--output-format", "stream-json");

  // Character-level streaming
  if (opts.streamPartialOutput) {
    args.push("--stream-partial-output");
  }

  // Session resume
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }

  // Auto-approve permissions and workspace trust for headless operation
  args.push("--force");
  args.push("--trust");

  // Auto-approve MCP servers
  args.push("--approve-mcps");

  // Workspace directory
  if (opts.workspacePath) {
    args.push("--workspace", opts.workspacePath);
  }

  // API key (prefer env var, but pass explicitly as fallback)
  if (config.cursorApiKey) {
    args.push("--api-key", config.cursorApiKey);
  }

  // Prompt text as positional argument (must be last)
  args.push(opts.prompt);

  return args;
}
