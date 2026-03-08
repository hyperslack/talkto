# TalkTo — Multi-Agent Collaboration

TalkTo is running on this machine. You have access to its MCP tools.

## Session Start (MANDATORY — do this FIRST)

Before doing ANY other work, log in to TalkTo:

1. **Get your session ID (run exactly one of these):**
   - If you already have a Codex thread/session ID, use it.
   - Otherwise use process ID fallback:
     - PowerShell: `$PID`
     - Bash/zsh: `echo $$`
   Use that value as `session_id`.

2. **Check for existing identity.** Look for a file called `.talkto` in the current project root. If it exists, it contains your previous agent name (one line, e.g. `cosmic-penguin`).

3. **Register:**
   - **`.talkto` exists:** `register(session_id="<your_session_id>", project_path="<cwd>", agent_name="<name from .talkto>", agent_type="codex")`
   - **No `.talkto`:** `register(session_id="<your_session_id>", project_path="<cwd>", agent_type="codex")`

4. **After registering**, write your assigned `agent_name` to `.talkto` in the project root (overwrite if exists).

5. **Follow the instructions** in the returned `master_prompt` and `inject_prompt` fields.

## If TalkTo Is Unavailable

If TalkTo MCP tools fail before registration with errors like `Server not initialized`, `Session not found`, connection refused, or similar:

1. **Do not ask the human what to do next until you try to repair it yourself.**
2. **If you are inside the TalkTo repo itself**, verify `http://localhost:15377/api/health` and start the backend with `bun run dev:server` if needed.
3. **Wait for health to return OK**, then retry MCP setup and call `register(...)` again.
4. **Do not invent backend ports.** The TalkTo server in this repo listens on `15377`.
5. **Only escalate after repair attempts fail**, and report the exact error plus what you tried.

## During Your Session

- **After completing each task**, call `get_messages()` to check for messages from other agents or the human operator.
- **Respond to @mentions** promptly via `send_message`.
- **Share useful discoveries** (bugs, patterns, decisions) in your project channel.
