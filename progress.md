# Progress Log

## Session: 2026-03-02 - Re-scoped planning for PR #50, #49, #48

### Status
- Exact PR review complete.
- Planning files updated to correct scope.
- No code implementation performed yet.

### Actions Completed
1. Replaced initial branch-based assumption after user clarified target PRs (`50, 49, 48`).
2. Fetched and reviewed:
   - PR metadata (draft/open/base/head/additions/files)
   - Changed file lists
   - Patch content for all three PRs
3. Compared PR scope against current local `main` to confirm changes are not yet merged.
4. Identified cross-PR dependency and merge-order risks (especially PR #50 depending on PR #49 behavior).
5. Rewrote `task_plan.md` and `findings.md` for exact PR scope.

### Key Outcomes
- PR #50 is not self-contained against `main` in its current form.
- PR #49 and PR #50 currently define overlapping tunnel strategies.
- PR #48 is suitable as a docs-first strategic artifact, pending issue/owner extraction.

### Next Actions (Execution)
1. Decide canonical tunnel approach (profile vs override) and enforce in PR #49/#50.
2. Resolve PR #50 base/dependency issue (self-contained or stacked rebase).
3. Add Windows-compatible sharing path for tunnel helper tooling.
4. Finalize merge sequencing and acceptance checks.

### Files Updated This Session
- `task_plan.md`
- `findings.md`
- `progress.md`

### Environment Notes
- `gh` CLI unauthenticated in this environment; GitHub API and patch endpoints used instead.

---

## Session: 2026-03-06 - Cursor parity debugging

### Status
- Cursor code path inspected.
- Local Cursor CLI validated on this Windows machine.
- Implementation bugs identified; patching started.

### Actions Completed
1. Compared Cursor registration/invocation code against Claude/Codex/OpenCode.
2. Ran existing `server/tests/cursor.test.ts`, `server/tests/mcp.test.ts`, and `bun run typecheck` to establish baseline.
3. Validated local Cursor install:
   - `cursor.cmd` present
   - standalone `agent.cmd` present
   - `agent.ps1` is blocked by PowerShell execution policy
4. Confirmed via `agent.cmd --help` that TalkTo should be using a resumable chat ID for `--resume`.
5. Confirmed current prompt/docs guidance around `CURSOR_TRACE_ID` is inconsistent with actual CLI semantics.

### Next Actions
1. Patch `server/src/sdk/cursor.ts` discovery/auth handling.
2. Update Cursor registration guidance in prompts and MCP tool descriptions.
3. Add targeted tests for Cursor registration semantics.

### Completed
1. Patched `server/src/sdk/cursor.ts` for robust CLI discovery, Windows fallbacks, and auth/error handling.
2. Updated Cursor registration guidance in README, MCP tool descriptions, and prompt templates.
3. Added MCP test coverage for Cursor registration guidance.
4. Posted the integration finding to TalkTo channel `#project-talkto`.

### Validation
- `bun test server/tests/cursor.test.ts` ✅
- `bun test server/tests/mcp.test.ts` ✅
- `bun test server/tests/prompt-engine.test.ts` ✅
- `bun run typecheck` ✅

### Environment Notes
- Running `bun test server/tests/cursor.test.ts server/tests/mcp.test.ts` in one combined command hit `EADDRINUSE` because the server test boot path expects isolation. Running the suites separately passed.

---

## Session: 2026-03-07 - Workspace sharing / lifecycle stability

### Status
- New multi-feature pass started.
- Planning refreshed from prior work and current dirty tree.
- Architecture/lifecycle audit underway.

### Requested Scope
1. Simplify workspace sharing and critique the current cross-machine collaboration architecture.
2. Add delete operations for channels and agents.
3. Allow editing agent profiles and stop relying solely on agents to self-report provider type.
4. Ship adjacent stability improvements where justified.

### Next Actions
1. Inspect workspace creation/share/join/auth code paths and current UI/API shape.
2. Inspect channel/agent lifecycle routes, services, and frontend affordances.
3. Inspect current provider detection logic across MCP registration and setup flows.

### Completed
1. Added `TALKTO_PUBLIC_BASE_URL` support in server config so share links and advertised MCP URLs can target a real public origin.
2. Added admin `PATCH /api/agents/:agentName`, `DELETE /api/agents/:agentName`, and `DELETE /api/channels/:channelId`.
3. Implemented agent/channel admin management inside the workspace settings sheet.
4. Hardened provider detection so OpenCode evidence overrides a bad `claude_code` self-report, while explicit Codex/Cursor still short-circuit correctly.
5. Added live invalidation events for agent/channel lifecycle changes and fixed Cursor invocability labeling in the sidebar.
6. Added targeted API + MCP coverage and revalidated frontend build/tests.

### Validation
- `bun run typecheck` ✅
- `bun test server/tests/mcp.test.ts` ✅
- `bun test server/tests/api.test.ts` ✅
- `cd frontend && bun run test` ✅
- `cd frontend && bun run build` ✅

### Environment Notes
- Frontend `vite`/`vitest` commands hit `spawn EPERM` inside the sandbox because esbuild could not start worker processes there. Re-running those commands outside the sandbox passed without code changes.

---

## Session: 2026-03-07 - Context menus and test DB isolation

### Status
- Right-click operator menus shipped for project channels and agents.
- Integration tests now use temp databases and skip live server binding.
- Validation complete.

### Requested Scope
1. Add shadcn context menus for projects and agents so delete and related actions are available on right click.
2. Ensure tests use a separate database so they do not populate the real product.
3. Investigate adjacent product improvements such as image paste/forward support.

### Completed
1. Added a shared Radix/shadcn-style context-menu primitive at `frontend/src/components/ui/context-menu.tsx`.
2. Added project-channel context menus with open/copy/delete actions in `frontend/src/components/workspace/channel-list.tsx`.
3. Added agent context menus with DM/copy/delete actions in `frontend/src/components/workspace/agent-list.tsx`.
4. Added frontend API coverage for channel deletion and agent update/delete requests.
5. Added `server/tests/test-env.ts` so integration suites always use a temp `TALKTO_DATA_DIR`.
6. Added `TALKTO_DISABLE_SERVER=1` test bootstrap handling in `server/src/index.ts` so test imports do not bind a real port.
7. Fixed `server/tests/api.test.ts` to create its own onboarded admin user inside the isolated test DB.

### Validation
- `bun run typecheck` ✅
- `bun test server/tests/api.test.ts server/tests/auth.test.ts server/tests/mcp.test.ts server/tests/messages-write.test.ts server/tests/ownership.test.ts server/tests/where-chaining.test.ts` ✅
- `cd frontend && bun run test` ✅
- `cd frontend && bun run build` ✅

### Environment Notes
- Frontend `bun run test` and `bun run build` still require execution outside the sandbox because Vite/esbuild worker spawning fails with `spawn EPERM` inside the sandbox.
- The prior `EADDRINUSE` issue on combined server integration runs was eliminated by disabling live server bootstrap under tests.
## Session: 2026-03-07 - Claude integration assessment

### Status
- Investigation started.
- Failure evidence captured from the provided log artifact.
- Local Claude executable presence confirmed.

### Actions Completed
1. Loaded current project state and prior investigation notes.
2. Extracted `Log talkto.docx` by unpacking the `.docx` archive and reading `word/document.xml`.
3. Confirmed the key failure in the supplied log is `Claude Code process exited with code 1` from `@anthropic-ai/claude-agent-sdk/sdk.mjs`.
4. Confirmed local Claude CLI presence via `where.exe claude` and PowerShell command resolution.
5. Compared TalkTo's wrapper with the installed SDK surface and found a likely contract mismatch: `permissionMode: \"bypassPermissions\"` is used without the required `allowDangerouslySkipPermissions: true`.
6. Confirmed that `claude auth status` cannot be trusted inside the sandbox because the CLI hits `uv_spawn 'reg' EPERM` before reporting auth state.
7. Re-ran `claude auth status` outside the sandbox and confirmed the local install reports as logged in.
8. Ran a minimal unrestricted `claude -p` command and found a separate environment issue: the stored OAuth token is expired and headless calls currently fail with `401 authentication_error`.

### Next Actions
1. Validate the suspected permission-flag mismatch against the current SDK typings and CLI behavior.
2. Inspect the installed SDK/CLI source to confirm whether TalkTo's missing `allowDangerouslySkipPermissions` flag is a hard validation requirement.
3. Determine whether the break is code-level, environment/setup-level, or both.

### Completed
1. Patched `server/src/sdk/claude.ts` to include the required `allowDangerouslySkipPermissions: true` flag and to clear Claude liveness on prompt failure.
2. Updated `prompts/claude_global_rules.md`, `prompts/registration_rules.md`, and `server/src/mcp/server.ts` to stop advertising PID fallback for Claude session registration.
3. Added MCP-side rejection for numeric Claude session IDs.
4. Added regression coverage in `server/tests/claude.test.ts` and `server/tests/mcp.test.ts`.

### Validation
- `bun test server/tests/claude.test.ts` ✅
- `bun test server/tests/mcp.test.ts` ✅
- `bun run typecheck` ✅

### Follow-up Completed
1. Patched `server/src/services/agent-invoker.ts` so Claude failures surface a clearer operator message and immediately ghost the failed agent.
2. Patched `server/src/services/agent-discovery.ts` so stale-credential cleanup also ends active sessions and broadcasts `agent_status=offline`.
3. Added `server/tests/agent-discovery.test.ts` for the offline/credential-clearing path.
4. Re-validated Claude CLI after re-login; a direct `claude -p` call now succeeds.

### Follow-up Validation
- `bun test server/tests/agent-discovery.test.ts` ✅
- `bun test server/tests/claude.test.ts` ✅
- `bun test server/tests/mcp.test.ts` ✅
- `bun run typecheck` ✅

---

## Session: 2026-03-08 - Registration verification / lifecycle simplification

### Status
- New lifecycle refactor started.
- Existing planning files synchronized.
- Code-path audit and Claude-specific root-cause work underway.

### Actions Completed
1. Confirmed the current subprocess lifecycle model is based on in-memory liveness Sets, not durable provider-backed verification.
2. Confirmed OpenCode is the only provider with a direct session health API today.
3. Verified Claude session recovery from local transcript files under `.claude/projects` and tightened prompt guidance to match `cwd` before reading `sessionId`.
4. Isolated the recent Claude invocation failure to TalkTo resuming from the wrong working directory.
5. Patched Claude SDK calls to pass `projectPath` as `cwd` and validated that change with targeted tests plus a live external resume probe returning `OK`.

### Next Actions
1. Finish auditing every registration/discovery/UI path that still depends on subprocess ghost probing.
2. Move subprocess verification to `register()`.
3. Remove proactive subprocess liveness checks while keeping failure-time invalidation.
4. Revalidate backend behavior and update operator-facing status semantics if needed.
