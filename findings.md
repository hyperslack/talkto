# Findings (PR #50, #49, #48 Review - 2026-03-02)

## Scope Confirmed
All three PRs are open drafts targeting `main`:
- PR #50 `feat/cloudflare-tunnel-sharing`
- PR #49 `feat/docker-compose-setup`
- PR #48 `rfc/hub-and-node-relay-architecture`

## PR #50 - Cloudflare Tunnel sharing
Files:
- `docker-compose.tunnel.yml`
- `scripts/share.sh`

### Findings
1. High: PR dependency mismatch
- `scripts/share.sh` runs `docker compose --profile tunnel up -d --build`.
- PR #50 base is `main`, but `main` does not define a `tunnel` profile (that is introduced in PR #49).
- Result: PR #50 is not self-contained against its current base branch.

2. High: override file likely incomplete in standalone mode
- `docker-compose.tunnel.yml` puts only `cloudflared` on `talkto-net`.
- Base `docker-compose.yml` (current `main`) does not attach `talkto` service to `talkto-net`.
- Result: override usage path can fail routing unless combined with PR #49 behavior.

3. Medium: cross-platform gap
- `scripts/share.sh` is bash-only, while repo emphasizes Windows compatibility for scripts/workflows.
- No PowerShell equivalent is included.

4. Medium: operational robustness
- URL detection scrapes logs repeatedly; no explicit check for Docker availability or compose plugin failure before loop.

## PR #49 - Docker Compose setup
Files:
- `docker-compose.yml`
- `docker/README.md`

### Findings
1. Medium: hardcoded `container_name` risks collisions
- Sets `talkto-server` and `talkto-tunnel` explicitly.
- This can conflict across multiple local clones/projects and reduces compose isolation.

2. Medium: tunnel service policy overlap with PR #50
- PR #49 introduces profile-based tunnel service.
- PR #50 introduces an override-file approach.
- Without consolidation, there are two competing configurations to maintain.

3. Low: docs quality is strong but may drift
- `docker/README.md` is thorough; requires alignment checks with root docs to avoid parallel instructions drifting.

## PR #48 - Hub/Node RFC
Files:
- `docs/RFC-relay-architecture.md`

### Findings
1. Positive: strong strategic doc
- Clear architecture direction, phased implementation plan, open questions, and migration framing.

2. Medium: needs decision gate artifacts before engineering kickoff
- RFC includes roadmap but not explicit owners/milestones in repo-native issue format.
- Should remain docs-only and feed issue creation rather than blend with infrastructure PRs.

## Cross-PR Findings
1. High: merge sequencing must be explicit
- PR #50 currently assumes pieces from PR #49 while targeting `main` directly.
- Either rebase PR #50 on PR #49 (stacked) or make PR #50 fully self-contained.

2. High: choose one tunnel configuration pattern
- Keep either profile-only or override-only as canonical. Dual patterns add maintenance risk.

3. Medium: security/ops readiness needs concrete validation
- Public URL sharing must include clear auth expectations, safe-sharing guidance, and tested start/stop behavior.

## Validation Notes
- Confirmed PR metadata, base/head, and changed files via GitHub API.
- Pulled `.patch` content for line-level review.
- Local repo `main` currently does not contain these PR changes.

---

# Findings (Cursor Parity / Debug Pass - 2026-03-06)

## Local Cursor CLI Validation
1. The machine has both `cursor.cmd` and a standalone Cursor agent install under `C:\Users\Yash\AppData\Local\cursor-agent\`.
2. In PowerShell, invoking bare `agent` resolves to `agent.ps1`, which fails here because script execution is disabled by policy.
3. `where.exe agent` returns `agent.cmd`, which works. That means server-side subprocess spawning can work if discovery prefers actual executables rather than PowerShell command resolution.
4. `agent.cmd --help` confirms the headless flags currently assumed by TalkTo are valid:
   - `-p`
   - `--output-format stream-json`
   - `--stream-partial-output`
   - `--resume [chatId]`
   - `--approve-mcps`
   - `--trust`
   - `--workspace`

## Cursor-Specific Bugs Identified
1. High: current registration guidance tells Cursor agents to use `CURSOR_TRACE_ID` as `session_id`.
   - Local validation shows `agent create-chat` returns a UUID-like chat ID.
   - Cursor CLI help says `--resume` expects a chat ID, not a trace ID.
   - `CURSOR_TRACE_ID` on this machine is a different shape entirely, so current guidance is incompatible with TalkTo's own invocation path.

2. High: `cursor.ts` hard-fails if `CURSOR_API_KEY` is not set before even attempting invocation.
   - Cursor CLI explicitly supports either stored login state or `CURSOR_API_KEY`.
   - TalkTo should not reject invocation early just because the env var is missing.

3. Medium: explicit `CURSOR_CLI_PATH` handling is too naive.
   - Current code assumes the override points directly to a standalone `agent` binary.
   - If a user points it at desktop `cursor` / `cursor.cmd`, TalkTo builds the wrong argv shape.

4. Medium: Windows guidance needs to avoid PowerShell's `agent.ps1` trap.
   - Docs/prompts should prefer an invocation path that maps to a resumable Cursor chat and actually runs on Windows.

## Fixes Applied
1. `server/src/sdk/cursor.ts`
   - CLI discovery now validates candidates instead of blindly trusting the first path hit.
   - Explicit `CURSOR_CLI_PATH` now infers the correct argv prefix for desktop `cursor` binaries.
   - Windows fallback paths now include the actual standalone `cursor-agent` wrappers present on this machine.
   - Invocation no longer hard-requires `CURSOR_API_KEY` before spawning the CLI.
   - Error reporting now surfaces authentication/setup failures from Cursor stderr/exit status.

2. Registration guidance
   - MCP tool descriptions now tell Cursor agents to use `agent create-chat`.
   - `prompts/registration_rules.md` and `prompts/cursor_global_rules.mdc` now describe the resumable chat-ID flow and mention `agent login` as an auth option.

3. Prompt rendering
   - `project_name` is now passed into `renderRegistrationRules()`, fixing unresolved template placeholders in the injected rules text.

4. Tests
   - Added MCP coverage verifying Cursor registration guidance references `create-chat` and no longer references `CURSOR_TRACE_ID`.

---

# Findings (Workspace Sharing / Lifecycle Stability - 2026-03-07)

## Architecture Audit
1. Workspace invite links are generated from `config.baseUrl`, and `baseUrl` currently derives only from localhost or LAN IP.
   - Result: invite links are not truly public unless the entire app is separately exposed and configured at that public origin.
   - This is the direct cause of the current “shared workspace link still points at localhost” problem.

2. The current product already separates human collaboration and agent collaboration correctly at a protocol level:
   - Humans: REST + browser session cookie + WebSocket streaming.
   - Agents: MCP over HTTP, typically authenticated by workspace API key.
   - This separation is sound for now and should remain.

3. MCP notifications are not the immediate answer for cross-machine agent-to-agent messaging.
   - TalkTo today stores messages centrally and triggers agent invocation from the server.
   - Human live streaming is a WebSocket/UI concern, not an MCP concern.
   - For remote/deployed agents, the harder problem is reachability and invocation authority, not intra-MCP notification syntax.

4. Deployed-agent support is still a broader architecture gap.
   - Current providers assume either local subprocess invocation or a locally reachable OpenCode server.
   - A truly deployed agent model likely needs an outbound registration/relay architecture or a public control plane, which matches the existing Hub/Node RFC direction more than a small local fix.

5. Provider detection currently trusts explicit `agent_type` too early.
   - If an OpenCode-backed agent self-reports `claude_code`, TalkTo routes the wrong provider.
   - The backend should prefer concrete OpenCode evidence (server URL or successful session probe) over self-description, except where a provider is otherwise undetectable (e.g. Codex/Cursor).

6. Operator lifecycle controls are incomplete.
   - No delete-channel route.
   - No delete-agent route.
   - No operator-facing REST/UI for editing agent profiles, despite agent self-update existing in MCP.

## Chosen Scope
This pass will implement:
1. Public-base-URL override support for invite and MCP links.
2. Channel deletion and agent deletion.
3. Operator editing for agent profiles.
4. Provider-detection hardening for OpenCode-vs-Claude misreports.
5. Small adjacent stability fixes discovered during implementation.

## Implemented
1. Public URL override
   - `server/src/lib/config.ts` now accepts `TALKTO_PUBLIC_BASE_URL`.
   - Invite URLs and advertised MCP URLs now use that override when present, instead of always deriving from localhost/LAN IP.

2. Admin lifecycle controls
   - Added channel deletion with dependent cleanup for messages, reactions, memberships, and read receipts.
   - Added agent deletion with dependent cleanup for sessions, memberships, DM channels, and live registry state.
   - Added admin agent-profile editing, including manual correction of `agent_type`.

3. Provider detection hardening
   - MCP registration now treats `server_url` or successful OpenCode session discovery as authoritative OpenCode evidence.
   - Explicit `codex` and `cursor` still short-circuit before OpenCode probing.
   - This removes the current failure mode where an OpenCode-backed Claude wrapper misreports itself as `claude_code` and becomes non-invocable.

4. Adjacent stability improvements
   - Added `agent_updated`, `agent_deleted`, and `channel_deleted` WebSocket events so live clients invalidate immediately after admin mutations.
   - Added Cursor label/invocability parity in the agent sidebar.
   - Reused the existing workspace settings sheet as the operator control surface rather than scattering destructive actions across the main UI.

## Product/Architecture Conclusion
1. Public sharing needs explicit origin configuration.
   - Relying on runtime LAN/localhost detection is not sufficient for public collaboration.
   - The correct immediate product shape is: operator exposes TalkTo at a public origin, sets `TALKTO_PUBLIC_BASE_URL`, then shares invite links/API keys generated from that origin.

2. Cross-machine collaboration should continue to use the current split:
   - Humans: REST + cookies + WebSocket.
   - Agents: MCP + API key.
   - Server-side message storage and invocation remain the source of truth.

3. MCP notifications are optional, not foundational.
   - They could help with future push-style agent UX, but they do not solve the harder requirement: how a central TalkTo server reaches deployed or remote agents and how those agents authenticate/respond.
   - For deployed agents, the real missing primitive is a relay/control-plane model or long-lived outbound connection, not just richer MCP semantics.

---

# Findings (Context Menus / Test DB Isolation / Messaging Gaps - 2026-03-07)

## UI Findings
1. The sidebar did not expose contextual actions where operators actually work.
   - Agent delete existed elsewhere, but not on the right-click path users expect in a Slack-like sidebar.
   - Project channels had no contextual affordance for copy/delete/open operations.

2. The frontend already had Radix/shadcn-style primitives available, so a native-feeling context menu could be added without bringing in a new dependency or inventing a bespoke interaction model.

## Test Infrastructure Findings
1. Integration tests were still coupled to real product state despite prior unit-test isolation.
   - Several suites imported `server/src/index.ts`, which seeded and opened the configured product database.
   - This meant test runs could populate the real TalkTo instance unless the environment was manually redirected.

2. The previous `EADDRINUSE` behavior was a bootstrap design problem, not just a bad test command.
   - Importing `server/src/index.ts` started a real `Bun.serve()` listener.
   - Multiple integration suites running together could collide on ports even though they only needed `app.fetch()`.

3. Some integration tests were implicitly relying on pre-existing local onboarding state.
   - Admin-route tests passed only when the real dev database already had a human admin.
   - Once tests were moved to isolated DBs, that hidden assumption surfaced as `403` failures.

## Messaging/Media Findings
1. Image paste/forward support is not a small follow-up to message input.
   - Current message storage is text-first.
   - There is no attachment table, upload/storage path, clipboard ingestion path, or forwarding semantics for binary/media payloads.

2. The frontend can render image URLs found in markdown-like content, but that is not attachment support.
   - It does not solve paste from clipboard.
   - It does not solve cross-platform upload handling.
   - It does not solve durable forwarding or re-sharing between agents/humans.

## Implemented
1. Added shared context-menu primitives and wired them into project channels and agents.
2. Forced integration suites onto temp databases through `server/tests/test-env.ts`.
3. Added `TALKTO_DISABLE_SERVER=1` handling so importing the app in tests does not bind a socket.
4. Updated admin integration tests to onboard their own human admin inside the isolated DB.

## Product Conclusion
1. Right-click context actions belong directly on the sidebar objects, not buried in a settings surface.
2. Test isolation should be guaranteed by bootstrap defaults in tests, not by relying on developers to remember alternate env vars.
3. Image paste/forward should be handled as a dedicated attachment feature slice with schema, storage, API, and rendering work, not as an incidental tweak to the composer.
## Findings (Claude Integration Assessment - 2026-03-07)

### Evidence gathered so far
1. The provided `Log talkto.docx` captures a real runtime failure in the server invoke path:
   - `Claude Code process exited with code 1`
   - Stack frames point into `server/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`
   - TalkTo then logs `Streaming error` and `No response` for the affected Claude agent.

2. The machine does have a concrete Claude executable:
   - `where.exe claude` resolves to `C:\Users\Yash\.local\bin\claude.exe`
   - PowerShell resolves `claude` directly as an application, not a blocked script shim.

3. This means the current failure is deeper than missing binary discovery:
   - The Claude subprocess is being launched.
   - It is failing after spawn, during SDK-driven execution.

### Strong root-cause candidate
4. TalkTo's Claude SDK wrapper appears incompatible with the installed Claude Agent SDK contract.
   - `server/src/sdk/claude.ts` calls `query()` with `permissionMode: "bypassPermissions"`.
   - The installed SDK typings (`server/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`) explicitly state that `allowDangerouslySkipPermissions` must also be set to `true` when using `permissionMode: 'bypassPermissions'`.
   - TalkTo does not pass that flag in either `promptSession()` or `promptSessionWithEvents()`.
   - This is a strong match for the observed behavior: child process starts, then exits immediately with code `1`.

5. One environment check is currently blocked by the sandbox, not by TalkTo itself.
   - `claude auth status` failed here with `uv_spawn 'reg' EPERM`.
   - That failure originates from the local `claude.exe` trying to spawn Windows `reg`, which the sandbox blocks.
   - Auth/setup still needs one unrestricted validation pass before ruling out a second environment issue.

### Environment findings
6. The local Claude install is in an inconsistent auth state.
   - Unrestricted `claude auth status` reports `loggedIn: true` with `authMethod: "claude.ai"`.
   - But unrestricted `claude -p "Reply with OK only." --permission-mode bypassPermissions --max-budget-usd 0.01` fails with:
     - `401 authentication_error`
     - `OAuth token has expired`
   - So even if TalkTo's code were fixed, this machine's Claude CLI currently needs re-authentication before headless invocation can succeed.

### Fixes applied
7. Patched `server/src/sdk/claude.ts` to build Claude query options centrally and include `allowDangerouslySkipPermissions: true` whenever TalkTo uses `permissionMode: "bypassPermissions"`.
8. Patched Claude registration prompts plus MCP tool descriptions to remove the invalid `$PID` / `$$` fallback and require a real Claude session ID.
9. Added an MCP guard that rejects numeric `claude_code` session IDs up front instead of accepting a non-resumable value.
10. Added regression coverage for the Claude query options and the Claude registration guidance/guardrails.

### Operator UX / lifecycle fixes
11. Claude invoke failures now drive the existing operator-visible invocation alert in the active channel instead of only logging server-side noise.
12. Claude invoke failures now immediately clear stale credentials, end active sessions, and broadcast an offline status so the failed agent stops appearing live.

### Current environment status
13. After re-authentication, headless Claude prompting works again with the same permission mode TalkTo uses.
   - Verified with `claude -p "Reply with OK only." --model sonnet --permission-mode bypassPermissions --allow-dangerously-skip-permissions`
   - Result: `OK`

---

## Findings (Registration Verification / Lifecycle Simplification - 2026-03-08)

### Current lifecycle model
1. Registration for subprocess agents (`claude_code`, `codex`, `cursor`) is optimistic.
   - `registerOrConnectAgent()` immediately marks those sessions alive in process-local Sets.
   - No provider-backed verification is performed before TalkTo accepts the credential.

2. Subprocess liveness after TalkTo restart is not durable.
   - Claude/Codex/Cursor liveness is tracked only in memory in their SDK wrappers.
   - After TalkTo restarts, those Sets are empty, so persisted credentials are not enough to prove liveness under the current model.

3. OpenCode is different.
   - It has a real session endpoint, so TalkTo can verify it without agent re-registration.

### Claude-specific discoveries
4. Claude session IDs are recoverable locally from `~/.claude/projects/.../*.jsonl`.
   - The first JSON line includes both `cwd` and `sessionId`.
   - Matching by `cwd` is necessary; the globally newest file is not a safe rule.

5. Claude invocation required `cwd` alignment.
   - TalkTo was resuming Claude with `resume=<sessionId>` but without passing the stored project path as SDK `cwd`.
   - Because root `dev:server` starts from `talkto/server`, Claude resume failed with `No conversation found...` for sessions actually bound to `talkto`.
   - Passing `cwd=projectPath` fixed direct resume probes against the real local Claude session.

### Product conclusion
6. A registration-time smoke test on the same headless resume path TalkTo uses for DMs/@mentions is a better truth source than proactive subprocess “alive” bookkeeping.
7. If registration verifies invocability, TalkTo can assume subprocess agents remain invocable until a real invoke proves otherwise.
8. Failure-time invalidation still matters and should remain, because auth/session validity can change after registration.
