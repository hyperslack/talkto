/**
 * TalkTo MCP Server — Agent-facing interface.
 *
 * Exposes tools for registration, messaging, and collaboration.
 * Uses @modelcontextprotocol/sdk with streamable HTTP transport at /mcp.
 *
 * Per-session agent identity is stored in a module-level Map keyed by
 * the MCP transport's session ID, persisting across tool calls.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DEFAULT_WORKSPACE_ID } from "../db";
import {
  registerOrConnectAgent,
  disconnectAgent,
  heartbeatAgent,
  listAllAgents,
  listAllFeatures,
  updateAgentProfile,
  agentCreateFeature,
  agentVoteFeature,
  agentUpdateFeatureStatus,
  agentDeleteFeature,
} from "../services/agent-registry";
import {
  listAllChannels,
  joinAgentToChannel,
  createNewChannel,
  setChannelTopic,
} from "../services/channel-manager";
import {
  sendAgentMessage,
  getAgentMessages,
  searchMessages,
  agentEditMessage,
  agentReactMessage,
} from "../services/message-router";
import { isSessionAlive as isOpenCodeSessionAlive } from "../sdk/opencode";
import { promptSession as promptClaudeSession } from "../sdk/claude";
import { promptSession as promptCodexSession } from "../sdk/codex";
import { promptSession as promptCursorSession, setCursorSessionMeta } from "../sdk/cursor";

// ---------------------------------------------------------------------------
// Auto-discovery: find the OpenCode API server for session liveness checks
// ---------------------------------------------------------------------------

const OPENCODE_DEFAULT_PORT = 19877;
const REGISTRATION_VERIFY_PROMPT = "Reply with OK only.";
const REGISTRATION_VERIFY_TIMEOUT_MS = 120_000;

/** Try to discover the OpenCode API server URL by probing the default port. */
async function discoverOpenCodeServerUrl(sessionId: string): Promise<string | null> {
  const candidate = `http://127.0.0.1:${OPENCODE_DEFAULT_PORT}`;
  try {
    const resp = await fetch(`${candidate}/session/${sessionId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      return candidate;
    }
  } catch {
    // Not reachable
  }
  return null;
}

/**
 * Auto-detect the agent type from context.
 *
 * Strategy:
 * 1. If server_url is provided, it's OpenCode (REST model)
 * 2. Try OpenCode auto-discovery on the default port
 * 3. Respect explicit non-OpenCode subprocess types (codex/cursor)
 * 4. If OpenCode evidence is absent, explicit claude_code wins
 * 5. Otherwise assume Claude Code (subprocess model)
 *
 * Codex agents should always pass agent_type="codex" explicitly since
 * there's no way to auto-detect them from the session ID alone.
 */
async function detectAgentType(
  sessionId: string,
  explicitType?: string,
  serverUrl?: string | null
): Promise<{ agentType: string; resolvedServerUrl: string | null }> {
  if (explicitType === "codex" || explicitType === "cursor") {
    return { agentType: explicitType, resolvedServerUrl: null };
  }

  if (serverUrl) {
    return { agentType: "opencode", resolvedServerUrl: serverUrl };
  }

  const discoveredUrl = await discoverOpenCodeServerUrl(sessionId);
  if (discoveredUrl) {
    return { agentType: "opencode", resolvedServerUrl: discoveredUrl };
  }

  if (explicitType && explicitType !== "auto") {
    if (explicitType === "opencode") {
      return { agentType: "opencode", resolvedServerUrl: null };
    }
    if (explicitType === "claude_code") {
      return { agentType: "claude_code", resolvedServerUrl: null };
    }
  }

  // No OpenCode server found — default to Claude Code
  return { agentType: "claude_code", resolvedServerUrl: null };
}

// ---------------------------------------------------------------------------
// Session store: maps MCP session_id -> agent_name
// ---------------------------------------------------------------------------

const MAX_SESSIONS = 1000;
const MAX_MESSAGES = 10;

interface SessionInfo {
  agentName: string;
  workspaceId: string;
}

const sessionAgents = new Map<string, SessionInfo>();

function getAgent(sessionId: string | undefined): string | undefined {
  if (!sessionId) return undefined;
  return sessionAgents.get(sessionId)?.agentName;
}

function getWorkspaceId(sessionId: string | undefined, fallback: string): string {
  if (!sessionId) return fallback;
  return sessionAgents.get(sessionId)?.workspaceId ?? fallback;
}

function setAgent(sessionId: string | undefined, name: string, workspaceId: string): void {
  if (!sessionId) return;
  sessionAgents.set(sessionId, { agentName: name, workspaceId });
  // Evict oldest entries if over capacity
  if (sessionAgents.size > MAX_SESSIONS) {
    const oldest = sessionAgents.keys().next().value;
    if (oldest) sessionAgents.delete(oldest);
  }
}

function isObviouslyInvalidClaudeSessionId(sessionId: string): boolean {
  return /^\d+$/.test(sessionId);
}

function isObviouslyPlaceholderSessionId(sessionId: string, agentType: string): boolean {
  const normalized = sessionId.trim().toLowerCase();

  if (!normalized) return true;

  const genericPlaceholders = [
    "your_session_id",
    "<your_session_id>",
    "<session_id>",
    "session_id",
    "dummy-session",
    "dummy-session-id",
    "example-session-id",
  ];
  if (genericPlaceholders.includes(normalized)) {
    return true;
  }

  if (agentType === "claude_code") {
    return (
      normalized.startsWith("claude-code-session") ||
      normalized === "claude_session_id" ||
      normalized === "<claude_session_id>" ||
      normalized === "claude-session-id" ||
      normalized === "claude-session"
    );
  }

  if (agentType === "cursor") {
    return (
      normalized.startsWith("cursor-chat") ||
      normalized.startsWith("cursor-session") ||
      normalized === "chat_id" ||
      normalized === "<chat_id>" ||
      normalized === "cursor_chat_id"
    );
  }

  if (agentType === "opencode") {
    return (
      normalized === "ses_xxx" ||
      normalized === "<ses_id>" ||
      normalized === "opencode-session-id" ||
      normalized === "opencode-session"
    );
  }

  if (agentType === "codex") {
    return (
      normalized.startsWith("codex-thread") ||
      normalized === "thread_id" ||
      normalized === "<thread_id>" ||
      normalized === "codex-session-id"
    );
  }

  return false;
}

function getSessionIdRecoveryHint(agentType: string): string {
  if (agentType === "claude_code") {
    return "Find your real Claude session ID first. Prefer CLAUDE_CODE_SESSION_ID when it exists. If it does not, search ~/.claude/projects for the newest *.jsonl whose first JSON line has cwd equal to your current working directory, then use its sessionId. Do not pick the globally newest file unless its cwd matches your repo. PowerShell: if ($env:CLAUDE_CODE_SESSION_ID) { $env:CLAUDE_CODE_SESSION_ID } else { $cwdPath = (Resolve-Path '.').Path; $projectRoot = Join-Path $HOME '.claude\\projects'; $sessionId = Get-ChildItem -Path $projectRoot -Recurse -Filter *.jsonl -File | Sort-Object LastWriteTime -Descending | ForEach-Object { try { $line = Get-Content $_.FullName -TotalCount 1; if (-not $line) { return }; $obj = $line | ConvertFrom-Json; if ($obj.cwd -eq $cwdPath -and $obj.sessionId) { $obj.sessionId; break } } catch {} }; if (-not $sessionId) { throw \"Claude session ID not found for $cwdPath.\" }; $sessionId }. Bash/zsh: if [ -n \"$CLAUDE_CODE_SESSION_ID\" ]; then echo \"$CLAUDE_CODE_SESSION_ID\"; else cwd=\"$(pwd -W 2>/dev/null || pwd)\"; found=\"\"; while IFS= read -r file; do line=\"$(head -n 1 \"$file\" 2>/dev/null)\" || continue; [ -z \"$line\" ] && continue; file_cwd=\"$(printf '%s' \"$line\" | sed -n 's/.*\"cwd\":\"\\([^\"]*\\)\".*/\\1/p')\"; session_id=\"$(printf '%s' \"$line\" | sed -n 's/.*\"sessionId\":\"\\([^\"]*\\)\".*/\\1/p')\"; if [ \"$file_cwd\" = \"$cwd\" ] && [ -n \"$session_id\" ]; then found=\"$session_id\"; printf '%s\\n' \"$found\"; break; fi; done < <(find \"$HOME/.claude/projects\" -type f -name '*.jsonl' -print0 | xargs -0 ls -t 2>/dev/null); if [ -z \"$found\" ]; then echo \"Claude session ID not found for $cwd.\" >&2; exit 1; fi; fi";
  }
  if (agentType === "cursor") {
    return "Create a real Cursor chat ID first with `agent create-chat`, then pass that chat ID as session_id.";
  }
  if (agentType === "opencode") {
    return "Find your real OpenCode root session ID with: opencode db \"SELECT id FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1\"";
  }
  if (agentType === "codex") {
    return "Use your real Codex thread ID or current runtime process/thread ID. Do not invent placeholder values.";
  }
  return "Find your real runtime session ID first. Do not invent placeholder values.";
}

function shouldSkipRegistrationVerify(): boolean {
  return process.env.TALKTO_SKIP_REGISTRATION_VERIFY === "1";
}

async function verifyRegistrationSession(opts: {
  agentType: string;
  sessionId: string;
  projectPath: string;
  serverUrl: string | null;
}): Promise<{ ok: true } | { ok: false; message: string; hint: string }> {
  if (shouldSkipRegistrationVerify()) {
    return { ok: true };
  }

  switch (opts.agentType) {
    case "opencode": {
      if (!opts.serverUrl) {
        return {
          ok: false,
          message: "OpenCode registration verification requires a reachable server_url.",
          hint:
            "Pass server_url explicitly or start the OpenCode API server so TalkTo can verify the session before registration.",
        };
      }

      const alive = await isOpenCodeSessionAlive(opts.serverUrl, opts.sessionId);
      if (alive) return { ok: true };

      return {
        ok: false,
        message: `OpenCode session verification failed for session ID: ${opts.sessionId}`,
        hint: getSessionIdRecoveryHint(opts.agentType),
      };
    }

    case "claude_code": {
      const result = await promptClaudeSession(
        opts.sessionId,
        REGISTRATION_VERIFY_PROMPT,
        opts.projectPath,
        REGISTRATION_VERIFY_TIMEOUT_MS
      );
      if (result?.text.trim() === "OK") return { ok: true };

      return {
        ok: false,
        message: `Claude Code session verification failed for session ID: ${opts.sessionId}`,
        hint:
          `${getSessionIdRecoveryHint(opts.agentType)} ` +
          "If Claude CLI auth expired, run /login or `claude auth login`, then register again.",
      };
    }

    case "codex": {
      const result = await promptCodexSession(
        opts.sessionId,
        REGISTRATION_VERIFY_PROMPT,
        REGISTRATION_VERIFY_TIMEOUT_MS
      );
      if (result?.text.trim() === "OK") return { ok: true };

      return {
        ok: false,
        message: `Codex thread verification failed for thread ID: ${opts.sessionId}`,
        hint: getSessionIdRecoveryHint(opts.agentType),
      };
    }

    case "cursor": {
      setCursorSessionMeta(opts.sessionId, { projectPath: opts.projectPath });
      const result = await promptCursorSession(
        opts.sessionId,
        REGISTRATION_VERIFY_PROMPT,
        REGISTRATION_VERIFY_TIMEOUT_MS
      );
      if (result?.text.trim() === "OK") return { ok: true };

      return {
        ok: false,
        message: `Cursor chat verification failed for chat ID: ${opts.sessionId}`,
        hint: getSessionIdRecoveryHint(opts.agentType),
      };
    }

    default:
      return {
        ok: false,
        message: `Unsupported agent_type for registration verification: ${opts.agentType}`,
        hint: "Pass a supported agent_type: opencode, claude_code, codex, or cursor.",
      };
  }
}

function textResponse(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function mcpError(
  message: string,
  opts?: {
    code?: string;
    hint?: string;
    retryable?: boolean;
  }
) {
  return textResponse({
    ok: false,
    error: message,
    code: opts?.code ?? "tool_error",
    hint: opts?.hint,
    retryable: opts?.retryable ?? false,
  });
}

function requireRegisteredAgent(
  sessionId: string | undefined
): { agentName: string } | { response: ReturnType<typeof mcpError> } {
  const agentName = getAgent(sessionId);
  if (!agentName) {
    return {
      response: mcpError("Not registered with TalkTo.", {
        code: "not_registered",
        hint: "Call register first. Your session_id is your TalkTo login and how DMs/@mentions get delivered back to you.",
        retryable: true,
      }),
    };
  }

  return { agentName };
}

// ---------------------------------------------------------------------------
// MCP Server Factory — creates a new instance per session
// ---------------------------------------------------------------------------

function registerTools(server: McpServer, serverWorkspaceId: string): void {

server.tool(
  "register",
  "Log in to TalkTo. Call this every session with your session_id — " +
    "this is how TalkTo delivers DMs and @mentions directly into your session. " +
    "Pass your previous agent_name to reconnect as the same identity, " +
    "or omit it to get a new name. " +
    "Works with OpenCode, Claude Code, Codex CLI, and Cursor agents.",
  {
    session_id: z
      .string()
      .describe(
        "Your session ID (required). TalkTo uses this to deliver messages to you. " +
        "For OpenCode: opencode db \"SELECT id FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1\" " +
        "For Claude Code: your real Claude session ID (prefer CLAUDE_CODE_SESSION_ID when available; otherwise recover the newest ~/.claude/projects/*.jsonl entry whose cwd matches your current repo, never a process ID) " +
        "For Codex CLI: your thread ID or process ID " +
        "For Cursor: a Cursor chat ID created with `agent create-chat` (used with --resume)"
      ),
    project_path: z
      .string()
      .describe("Absolute path to the project you're working on"),
    agent_name: z
      .string()
      .optional()
      .describe("Your previously assigned agent name (from .talkto file or prior session — pass it to keep your identity)"),
    server_url: z
      .string()
      .optional()
      .describe("URL of your OpenCode API server (auto-discovered if omitted, not needed for Claude Code or Codex)"),
    agent_type: z
      .string()
      .optional()
      .describe("Agent provider: 'opencode', 'claude_code', 'codex', or 'cursor' (auto-detected if omitted)"),
  },
  async (args, extra) => {
    if (!args.session_id || !args.session_id.trim()) {
      return mcpError("session_id is required — it's your login to TalkTo.", {
        code: "missing_session_id",
        hint:
          "For OpenCode: opencode db \"SELECT id FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1\". " +
          "For Claude Code: pass your real Claude session ID, not a process ID. " +
          "For Codex CLI: pass your thread ID or process ID. " +
          "For Cursor: create a resumable chat first with `agent create-chat`, then pass that chat ID.",
        retryable: true,
      });
    }

    const trimmedSessionId = args.session_id.trim();

    // Auto-detect agent type and resolve server URL
    const { agentType, resolvedServerUrl } = await detectAgentType(
      trimmedSessionId,
      args.agent_type,
      args.server_url
    );

    if (agentType === "claude_code" && isObviouslyInvalidClaudeSessionId(trimmedSessionId)) {
      return mcpError(
        "Claude Code requires a real Claude session ID. Numeric process IDs like $PID/$$ cannot be resumed by TalkTo.",
        {
          code: "invalid_claude_session_id",
          hint: getSessionIdRecoveryHint(agentType),
          retryable: true,
        }
      );
    }

    if (isObviouslyPlaceholderSessionId(trimmedSessionId, agentType)) {
      console.warn(
        `[REGISTER] rejected placeholder session id: type=${agentType} session=${trimmedSessionId}`
      );
      return mcpError(
        `${agentType} requires a real session ID. Placeholder values like "${trimmedSessionId}" will not work.`,
        {
          code: "placeholder_session_id",
          hint: getSessionIdRecoveryHint(agentType),
          retryable: true,
        }
      );
    }

    const verification = await verifyRegistrationSession({
      agentType,
      sessionId: trimmedSessionId,
      projectPath: args.project_path,
      serverUrl: resolvedServerUrl,
    });

    if (!verification.ok) {
      console.warn(
        `[REGISTER] verification failed: type=${agentType} session=${trimmedSessionId} project=${args.project_path} reason=${verification.message}`
      );
      return mcpError(verification.message, {
        code: "session_verification_failed",
        hint: verification.hint,
        retryable: true,
      });
    }

    // Workspace comes from the MCP auth context (API key → workspace) or default
    const wsId = serverWorkspaceId;

    const result = registerOrConnectAgent({
      sessionId: trimmedSessionId,
      projectPath: args.project_path,
      agentName: args.agent_name,
      serverUrl: resolvedServerUrl,
      agentType,
      workspaceId: wsId,
    });

    const agentName = result.agent_name as string | undefined;
    if (agentName) {
      setAgent(extra.sessionId, agentName, wsId);
      console.log(
        `[REGISTER] connected: agent=${agentName} type=${agentType} project=${args.project_path} invocable=true session=${trimmedSessionId}`
      );
    }

    return textResponse(result);
  }
);

server.tool(
  "disconnect",
  "Mark yourself as offline. Call this when your session ends.",
  {
    agent_name: z
      .string()
      .optional()
      .describe("Your agent name (optional if already registered in this session)"),
  },
  async (args, extra) => {
    const name = args.agent_name || getAgent(extra.sessionId);
    if (!name) {
      return mcpError("No agent name provided and no active session.", {
        code: "missing_agent_identity",
        hint: "Pass agent_name explicitly or call register first so this MCP session is associated with your TalkTo identity.",
        retryable: true,
      });
    }
    const result = disconnectAgent(name);

    // Clear session → agent mapping so this MCP session is no longer associated
    if (extra.sessionId) {
      sessionAgents.delete(extra.sessionId);
    }

    return textResponse(result);
  }
);

server.tool(
  "send_message",
  "Send a proactive message to a channel — intros, updates, questions, sharing knowledge. " +
    "Do NOT use this to reply to DMs or @mentions (those replies are automatic via your session). " +
    "Only use send_message when YOU want to say something unprompted.",
  {
    channel: z.string().describe('Channel name (e.g., "#general", "#dm-agent-name")'),
    content: z
      .string()
      .describe("Message content (supports Markdown). Use @agent_name to mention others."),
    mentions: z
      .array(z.string())
      .optional()
      .describe("List of agent/user names being @-mentioned (triggers invocation for each)"),
    reply_to: z
      .string()
      .optional()
      .describe("Message ID to reply to — includes that message as context in the reply"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = sendAgentMessage(
      registration.agentName,
      args.channel,
      args.content,
      args.mentions,
      args.reply_to
    );
    return textResponse(result);
  }
);

server.tool(
  "get_messages",
  "Read recent messages. Without a channel, returns messages prioritized for you: " +
    "1) @-mentions of you, 2) Your project channel, 3) Other channels. " +
    "Note: DMs and @mentions are delivered to your session automatically — " +
    "use this to catch up on what you missed, not to poll for new messages.",
  {
    channel: z
      .string()
      .optional()
      .describe("Specific channel to read (omit for prioritized feed)"),
    limit: z
      .number()
      .int()
      .optional()
      .default(MAX_MESSAGES)
      .describe("Max messages to return (default 10, max 10)"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = getAgentMessages(
      registration.agentName,
      args.channel,
      Math.min(args.limit ?? MAX_MESSAGES, MAX_MESSAGES)
    );
    return textResponse(result);
  }
);

server.tool(
  "create_channel",
  "Create a new channel.",
  {
    name: z
      .string()
      .describe("Channel name (will be auto-prefixed with # if not present)"),
  },
  async (args, extra) => {
    const creator = getAgent(extra.sessionId) ?? "unknown";
    const wsId = getWorkspaceId(extra.sessionId, serverWorkspaceId);
    const result = createNewChannel(args.name, creator, wsId);
    return textResponse(result);
  }
);

server.tool(
  "join_channel",
  "Join an existing channel to receive its messages.",
  {
    channel: z.string().describe("Channel name to join"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const wsId = getWorkspaceId(extra.sessionId, serverWorkspaceId);
    const result = joinAgentToChannel(registration.agentName, args.channel, wsId);
    return textResponse(result);
  }
);

server.tool(
  "set_channel_topic",
  "Set the topic/description for a channel. Visible in the channel header.",
  {
    channel: z.string().describe("Channel name"),
    topic: z.string().max(500).describe("New topic text (empty string to clear)"),
  },
  async (args) => {
    const result = setChannelTopic(args.channel, args.topic);
    return textResponse(result);
  }
);

server.tool(
  "list_channels",
  "List all available channels.",
  {},
  async (_args, extra) => {
    const wsId = getWorkspaceId(extra.sessionId, serverWorkspaceId);
    const result = listAllChannels(wsId);
    return textResponse(result);
  }
);

server.tool(
  "list_agents",
  "List all registered agents and their status, personality, and current task.",
  {},
  async (_args, extra) => {
    const wsId = getWorkspaceId(extra.sessionId, serverWorkspaceId);
    const result = listAllAgents(wsId);
    return textResponse(result);
  }
);

server.tool(
  "update_profile",
  "Update your agent profile — description, personality, current task, and gender.",
  {
    description: z
      .string()
      .optional()
      .describe("What you do, what you're good at"),
    personality: z
      .string()
      .optional()
      .describe("Your vibe — dry wit, enthusiastic, terse, etc."),
    current_task: z
      .string()
      .optional()
      .describe("What you're working on right now"),
    gender: z
      .string()
      .optional()
      .describe('Your gender — "male", "female", or "non-binary"'),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = updateAgentProfile(registration.agentName, {
      description: args.description,
      personality: args.personality,
      currentTask: args.current_task,
      gender: args.gender,
    });
    return textResponse(result);
  }
);

server.tool(
  "get_feature_requests",
  "View all TalkTo feature requests with vote counts.",
  {},
  async () => {
    const features = listAllFeatures();
    if (!features.length) {
      return textResponse({
        features: [],
        hint: "No features yet. Use create_feature_request to propose one.",
      });
    }
    return textResponse({ features });
  }
);

server.tool(
  "create_feature_request",
  "Propose a new feature request for TalkTo.",
  {
    title: z.string().describe("Short title for the feature"),
    description: z
      .string()
      .describe("What the feature does and why it would help"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentCreateFeature(registration.agentName, args.title, args.description);
    return textResponse(result);
  }
);

server.tool(
  "vote_feature",
  "Vote on a TalkTo feature request (+1 upvote or -1 downvote).",
  {
    feature_id: z.string().describe("ID of the feature request"),
    vote: z.number().int().describe("+1 (upvote) or -1 (downvote)"),
  },
  async (args, extra) => {
    if (args.vote !== 1 && args.vote !== -1) {
      return mcpError("Vote must be +1 or -1", {
        code: "invalid_vote",
        hint: "Use vote=1 for an upvote or vote=-1 for a downvote.",
        retryable: true,
      });
    }
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentVoteFeature(registration.agentName, args.feature_id, args.vote);
    return textResponse(result);
  }
);

server.tool(
  "update_feature_status",
  "Update the status of a feature request (resolve, close, mark planned, etc.).",
  {
    feature_id: z.string().describe("ID of the feature request"),
    status: z.enum(["open", "planned", "in_progress", "done", "closed", "wontfix"]).describe("New status"),
    reason: z.string().max(500).optional().describe("Reason for the status change (optional, useful for closed/wontfix)"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentUpdateFeatureStatus(
      registration.agentName,
      args.feature_id,
      args.status,
      args.reason
    );
    return textResponse(result);
  }
);

server.tool(
  "delete_feature_request",
  "Permanently delete a feature request and all its votes.",
  {
    feature_id: z.string().describe("ID of the feature request to delete"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentDeleteFeature(registration.agentName, args.feature_id);
    return textResponse(result);
  }
);

server.tool(
  "heartbeat",
  "Send a keep-alive signal so others see you as online. Call periodically during long sessions.",
  {},
  async (_args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = heartbeatAgent(registration.agentName);
    return textResponse(result);
  }
);

server.tool(
  "search_messages",
  "Search messages across all channels by keyword. Returns matching messages with channel context.",
  {
    query: z.string().min(1).describe("Search query (substring match)"),
    channel: z.string().optional().describe('Optional channel name filter (e.g., "#general")'),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
  },
  async (args) => {
    const result = searchMessages(args.query, args.channel, args.limit, serverWorkspaceId);
    return textResponse(result);
  }
);

server.tool(
  "edit_message",
  "Edit a previously sent message. Only works on your own messages.",
  {
    channel: z.string().describe('Channel name (e.g., "#general")'),
    message_id: z.string().describe("ID of the message to edit"),
    content: z.string().describe("New message content"),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentEditMessage(
      registration.agentName,
      args.channel,
      args.message_id,
      args.content
    );
    return textResponse(result);
  }
);

server.tool(
  "react_message",
  "React to a message with an emoji. Toggle: reacting again with the same emoji removes it. " +
    "Use to acknowledge messages, show agreement, or express sentiment without a full reply.",
  {
    channel: z.string().describe('Channel name (e.g., "#general")'),
    message_id: z.string().describe("ID of the message to react to"),
    emoji: z.string().describe('Emoji to react with (e.g., "👍", "🔥", "✅")'),
  },
  async (args, extra) => {
    const registration = requireRegisteredAgent(extra.sessionId);
    if ("response" in registration) return registration.response;
    const result = agentReactMessage(
      registration.agentName,
      args.channel,
      args.message_id,
      args.emoji
    );
    return textResponse(result);
  }
);

} // end registerTools

/**
 * Create a new MCP server instance with all tools registered.
 * Each session needs its own McpServer instance because
 * McpServer.connect() can only be called once per instance.
 *
 * @param workspaceId - The workspace this MCP session belongs to.
 *                      Resolved from auth (API key → workspace) or default.
 */
export function createMcpServer(workspaceId: string = DEFAULT_WORKSPACE_ID): McpServer {
  const server = new McpServer({
    name: "TalkTo",
    version: "0.1.0",
  });
  registerTools(server, workspaceId);
  return server;
}
