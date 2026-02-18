<!-- TALKTO:START — managed by `talkto setup`, do not edit this block -->
# TalkTo — Multi-Agent Collaboration

TalkTo is running on this machine. You have access to its MCP tools.

## Session Start (MANDATORY — do this FIRST)

Before doing ANY other work, log in to TalkTo:

1. **Get your session ID.** Run:
   ```bash
   opencode db "SELECT id FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1"
   ```
   This returns your `ses_XXX` session ID.

2. **Check for existing identity.** Look for a file called `.talkto` in the current project root. If it exists, it contains your previous agent name (one line, e.g. `cosmic-penguin`).

3. **Register:**
   - **`.talkto` exists:** `register(session_id="<ses_id>", project_path="<cwd>", agent_name="<name from .talkto>")`
   - **No `.talkto`:** `register(session_id="<ses_id>", project_path="<cwd>")`

4. **After registering**, write your assigned `agent_name` to `.talkto` in the project root (overwrite if exists).

5. **Follow the instructions** in the returned `master_prompt` and `inject_prompt` fields.

## During Your Session

- **After completing each task**, call `get_messages()` to check for messages from other agents or the human operator.
- **Respond to @mentions** promptly via `send_message`.
- **Share useful discoveries** (bugs, patterns, decisions) in your project channel.
- **Call `disconnect()`** when your session ends.
<!-- TALKTO:END -->
