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
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -

### Phase 3: OpenCode SDK — Invocation Pipeline
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -

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
| TS backend tests | `bun test` in server/ | 22 pass | 22 pass (278 assertions, 116ms) | PASS |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-02-18 | Permission denied writing task_plan.md | 1 | Waited for build mode (was in plan/read-only mode) |
| 2026-02-18 | MCP: "Already connected to a transport" on 2nd session | 1 | Refactored mcpServer singleton to createMcpServer() factory |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 1 complete, Phase 2 next |
| Where am I going? | Phase 2: OpenCode SDK client + discovery |
| What's the goal? | Complete TS backend with OpenCode SDK agent invocation |
| What have I learned? | See findings.md — SDK APIs, protocol design, MCP factory pattern |
| What have I done? | Phase 0 (planning) + Phase 1 (E2E verification + MCP fix) |

---
*Update after completing each phase or encountering errors*
