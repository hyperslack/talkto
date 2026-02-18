# Progress Log

## Session: 2026-02-18

### Phase 0: Planning
- **Status:** complete
- **Started:** 2026-02-18
- Actions taken:
  - Explored full codebase state (TS backend, Python backend, frontend, DB schema)
  - Researched OpenCode SDK, Codex SDK, Claude Agent SDK APIs and types
  - Designed TalkTo communication protocol (SDK-native replies for all invocations)
  - Discussed and resolved key architectural decisions with user
  - Committed TS backend foundation (735fca2 — 26 files, 4,398 lines)
  - Created planning files: task_plan.md, findings.md, progress.md
- Files created/modified:
  - task_plan.md (created)
  - findings.md (created)
  - progress.md (created)
- Key decisions:
  - All replies via `session.prompt()` — TalkTo posts response, agents don't need MCP send_message
  - OpenCode SDK first, Codex + Claude later
  - `session.list()` replaces ps/lsof/process-tree discovery
  - DMs: no context stuffing. @mentions: last 5-10 channel messages
  - TUI integration (`tui.appendPrompt` + `event.subscribe`) planned as Phase 4

### Phase 1: Frontend Switch & E2E Verification
- **Status:** complete
- **Started:** 2026-02-18
- Actions taken:
  - Stopped Python backend on :8000, started TS backend on :8000
  - Verified all 14 API routes return correct data from shared SQLite DB
  - Verified WebSocket: connect, ping/pong, subscribe, message broadcast
  - Found and fixed MCP bug: singleton McpServer -> factory pattern (createMcpServer())
  - Verified MCP: init, tools/list (13 tools), multi-session support
  - Started frontend on :3000, verified proxy works
  - All 22 tests still pass after MCP refactor
  - Committed as 67083ef
- Files created/modified:
  - server/src/mcp/server.ts (refactored: export singleton -> export factory)
  - server/src/index.ts (use createMcpServer() per session)

### Phase 2: OpenCode SDK — Client & Discovery
- **Status:** complete
- **Committed:** 9fec25c
- Actions taken:
  - Installed `@opencode-ai/sdk@1.2.6`
  - Created `server/src/sdk/opencode.ts` — cached client manager with getClient(), listSessions(), getSession(), isSessionAlive(), isServerHealthy(), promptSession(), extractTextFromParts(), matchSessionByProject(), discoverSession(), tuiPrompt()
  - Created `server/src/services/agent-discovery.ts` — simplified discovery: discoverOpenCodeServer() (lsof), getAgentInvocationInfo() (DB → liveness → auto-discover), clearStaleCredentials(), isAgentGhost()
  - 15 new tests for matchSessionByProject and extractTextFromParts
  - 37 total tests passing (298 assertions)
- Files created/modified:
  - server/src/sdk/opencode.ts (created)
  - server/src/services/agent-discovery.ts (created)
  - server/tests/opencode.test.ts (created)
  - server/package.json (added @opencode-ai/sdk)

### Phase 3: OpenCode SDK — Invocation Pipeline
- **Status:** complete
- Actions taken:
  - Created `server/src/services/agent-invoker.ts` — invocation engine: invokeForMessage(), invokeAgent(), postAgentResponse(), fetchRecentContext(), formatChannelPrompt(), spawnBackgroundTask()
  - Wired invokeForMessage() into routes/messages.ts POST handler and message-router.ts sendAgentMessage()
  - **Key discovery:** session.prompt() hangs on busy sessions (e.g., agent's active TUI session). Fixed by creating dedicated invocation sessions per agent via session.create()
  - Added to SDK: createSession(), getOrCreateInvocationSession(), clearInvocationSession(), prompt timeout (2 min)
  - Fixed isServerHealthy() — client.global.health doesn't exist, use session.list() instead
  - Live-tested DM invocation: Bossu→plucky-sparrow, response in ~2.5s
  - Live-tested conversation history: session reuse works, agent recalls prior messages
  - Live-tested @mention in #general: "what is 2+2?" → "4"
  - 37 tests pass (298 assertions)
- Files created/modified:
  - server/src/services/agent-invoker.ts (created)
  - server/src/sdk/opencode.ts (updated: createSession, getOrCreateInvocationSession, prompt timeout, health fix)
  - server/src/routes/messages.ts (modified: wired invokeForMessage)
  - server/src/services/message-router.ts (modified: wired invokeForMessage)
- Key discovery:
  - session.prompt() hangs indefinitely on busy sessions (no status field exposed by OpenCode API)
  - Fix: always create dedicated invocation sessions per agent, cache and reuse them
  - session.create() works, new sessions are idle and respond to prompt() in 2-3s
  - Invocation sessions maintain conversation history across prompts

### Phase 4: TUI Integration & Event Subscription
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -

### Phase 5: Infrastructure & Documentation
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TS backend tests | `bun test` in server/ | 37 pass | 37 pass (298 assertions, 122ms) | PASS |
| Live DM invocation | DM "Reply with exactly: LIVE_TEST_OK" to plucky-sparrow | Agent response in channel | "LIVE_TEST_OK" posted in 2.5s | PASS |
| Live conversation memory | DM "What was the last thing I asked you?" | Recalls prior message | Correctly recalled LIVE_TEST_OK request | PASS |
| Live @mention | @plucky-sparrow in #general "what is 2+2?" | Agent responds in channel | "4" posted | PASS |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-02-18 | Permission denied writing task_plan.md | 1 | Waited for build mode (was in plan/read-only mode) |
| 2026-02-18 | MCP: "Already connected to a transport" on 2nd session | 1 | Refactored mcpServer singleton to createMcpServer() factory |
| 2026-02-18 | session.prompt() hangs on busy session (plucky-sparrow's TUI) | 2 | Create dedicated invocation sessions per agent via session.create() |
| 2026-02-18 | client.global.health is not a function | 1 | Use session.list() as health check instead |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 3 complete, Phase 4 next |
| Where am I going? | Phase 4: TUI integration (tui.appendPrompt + event.subscribe) |
| What's the goal? | Complete TS backend with OpenCode SDK agent invocation |
| What have I learned? | session.prompt() hangs on busy sessions → use dedicated invocation sessions |
| What have I done? | Phases 0-3 complete. DM + @mention invocation working end-to-end |

---
*Update after completing each phase or encountering errors*
