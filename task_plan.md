# Task Plan: PR #50, #49, #48 Merge-Readiness (2026-03-02)

## Goal
Turn draft PRs `#50`, `#49`, and `#48` into a merge-ready, sequenced rollout that supports reliable public sharing and long-term Hub/Node product direction.

## Locked Scope (from GitHub API)
- PR #50: `feat: Public URL exposure via Cloudflare Tunnel for sharing`
  - Base: `main`
  - Head: `feat/cloudflare-tunnel-sharing`
  - Files: `docker-compose.tunnel.yml`, `scripts/share.sh`
- PR #49: `feat: Docker Compose setup for local development and testing`
  - Base: `main`
  - Head: `feat/docker-compose-setup`
  - Files: `docker-compose.yml`, `docker/README.md`
- PR #48: `RFC: Hub-and-Node Relay Architecture for Multi-Machine Agent Collaboration`
  - Base: `main`
  - Head: `rfc/hub-and-node-relay-architecture`
  - Files: `docs/RFC-relay-architecture.md`

## Current Phase
Phase 2 - dependency and hardening plan defined; implementation pending.

## Phases

### Phase 1: Scope verification and dependency mapping
Status: complete
- Validate exact PR metadata from GitHub API.
- Pull patch content for each PR and verify file-level scope.
- Identify inter-PR dependencies.

Exit criteria:
- Exact three-PR scope confirmed.

### Phase 2: PR #48 (RFC) decision hardening
Status: pending
Files:
- `docs/RFC-relay-architecture.md`

Tasks:
- Keep this PR docs-only and decision-focused.
- Add explicit assumptions/non-goals and rollout gates needed before coding starts.
- Extract implementation roadmap into actionable backlog items (epics/issues) with owners.

Exit criteria:
- RFC is clear, reviewable, and implementation-ready (without mixing code changes).

### Phase 3: PR #49 (Docker foundation) hardening
Status: pending
Files:
- `docker-compose.yml`
- `docker/README.md`

Tasks:
- Remove or justify hardcoded `container_name` values to avoid multi-project/container collisions.
- Validate that tunnel profile remains optional and does not impact default `docker compose up` flow.
- Ensure docs align with current root README/AGENTS conventions.
- Add smoke-check commands to docs and (if feasible) CI notes.

Exit criteria:
- Docker setup is portable, reproducible, and docs are aligned.

### Phase 4: PR #50 (Tunnel sharing UX) hardening
Status: pending
Files:
- `docker-compose.tunnel.yml`
- `scripts/share.sh`

Tasks:
- Resolve configuration strategy conflict: profile (`PR #49`) vs override file (`PR #50`) so there is one canonical path.
- If keeping override file, ensure `talkto` and `cloudflared` are on the same network in override mode.
- Remove implicit dependency on PR #49 or retarget PR #50 base branch to PR #49.
- Add Windows-compatible sharing command path (`scripts/share.ps1` or equivalent) to match cross-platform repo expectations.
- Improve robustness of URL extraction and failure messaging.

Exit criteria:
- Sharing flow works from a clean `main` checkout (or explicit stacked base) on supported platforms.

### Phase 5: Security and rollout validation
Status: pending
Tasks:
- Validate remote access behavior through tunnel (auth expectations, onboarding path, API key usage).
- Add explicit safe-sharing warnings in docs and script output.
- Run smoke tests for start/stop and URL retrieval.
- Final merge sequencing recommendation.

Exit criteria:
- Operational and security behavior is explicit and tested for intended usage.

## Merge Order Recommendation
1. PR #48 (RFC/docs) first.
2. PR #49 (Docker foundation).
3. PR #50 (Tunnel UX), after resolving profile/override dependency.

## Acceptance Checklist
- PR #48 remains docs-only and actionably scoped.
- PR #49 avoids container-name collisions and keeps default flow stable.
- PR #50 works independently against its base branch or is correctly rebased as a stacked PR.
- Tunnel documentation includes clear security guidance and stop/cleanup steps.
- Sharing flow is usable on both Unix-like systems and Windows.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Initial review targeted wrong local branches instead of PR numbers | 1 | Re-scoped to exact PRs `#50/#49/#48` after user clarification. |
| GitHub CLI unauthenticated (`gh` 401) | 1 | Used GitHub REST API + `.patch` endpoints via `curl` to gather exact metadata and diffs. |
| Frontend tests in sandbox fail with `spawn EPERM` (unrelated to these PRs) | 1 | Kept as environment limitation; not a blocker for docs/docker planning updates. |

---

# Task Plan: Cursor Parity / Debug Pass (2026-03-06)

## Goal
Make the current Cursor integration behave like the other supported providers for registration, invocation, and documentation-driven setup, with special attention to Windows behavior and real Cursor CLI semantics.

## Current Phase
Phase 1 - implementation underway.

## Phases

### Phase 1: Inspect real Cursor assumptions
Status: complete
- Compare `server/src/sdk/cursor.ts` against Claude/Codex/OpenCode paths.
- Validate local Cursor CLI help and install layout on this machine.
- Identify mismatches between prompts/docs and real CLI behavior.

Exit criteria:
- Concrete integration bugs identified from code plus local CLI validation.

### Phase 2: Patch Cursor backend and prompts
Status: in_progress
- Fix CLI discovery/override logic for Windows and explicit `CURSOR_CLI_PATH`.
- Remove invalid hard requirement that `CURSOR_API_KEY` must be present before any prompt attempt.
- Update Cursor registration guidance to use a resumable chat ID instead of `CURSOR_TRACE_ID`.
- Add/adjust tests for Cursor-specific MCP and prompt behavior.

Exit criteria:
- Cursor registration/invocation path matches actual CLI semantics and passes targeted tests.

### Phase 3: Verify and document
Status: pending
- Run targeted test suites and typecheck.
- Update planning files with findings/results.
- Share org-relevant Cursor integration learnings via TalkTo if feasible.

Exit criteria:
- Targeted validation passes and final findings are recorded.

---

# Task Plan: Workspace Sharing / Agent Lifecycle Stability (2026-03-07)

## Goal
Simplify workspace sharing and multi-machine collaboration, add missing deletion/profile-management operations, harden provider detection so agent type does not rely on self-reporting, and implement adjacent stability improvements that reduce operator friction.

## Current Phase
Phase 5 - validated and documented.

## Phases

### Phase 1: Audit current sharing and lifecycle flows
Status: complete
- Inspect current workspace creation/sharing, API key/auth, agent CRUD, and profile update flows.
- Map user journey for:
  - local human creating/sharing a workspace
  - remote human joining a shared workspace
  - remote/local agents collaborating across machines
- Identify where current localhost-based links and MCP assumptions break down.

Exit criteria:
- Concrete architecture/product gaps identified with current implementation references.

### Phase 2: Define target architecture and scope
Status: complete
- Decide which parts are product/architecture decisions vs direct code fixes.
- Resolve immediate questions:
  - public link model vs localhost-exposed join flow
  - what should be HTTP/WebSocket vs MCP for cross-machine collaboration
  - what changes if an agent is deployed remotely
  - whether MCP notifications are useful or sufficient for agent-to-agent/live updates
- Choose implementable subset for this pass.

Exit criteria:
- Clear implementation scope with documented assumptions and deferred questions.

Chosen implementation scope for this pass:
- Add a public-base-URL override so invite links and MCP URLs stop hardcoding localhost/LAN-only origins.
- Add delete channel / delete agent APIs and frontend affordances.
- Add operator-facing agent profile editing.
- Change provider detection to prefer OpenCode evidence over self-reported `claude_code` when a real OpenCode session/server is discoverable.
- Ship small adjacent stability/UI fixes discovered during audit.

### Phase 3: Implement operator-facing lifecycle improvements
Status: complete
- Add delete-channel support.
- Add delete-agent support.
- Add operator editing for agent profiles.
- Harden provider detection / registration so OpenCode+Claude wrapper cases do not depend on agent self-reporting.

Exit criteria:
- Core lifecycle/admin actions are available and tested.

### Phase 4: Adjacent stability improvements
Status: complete
- Implement one or more high-leverage adjacent fixes discovered during audit.
- Update docs/prompts/API responses as needed.

Exit criteria:
- Additional stability improvements are shipped, not just noted.

### Phase 5: Validate and document
Status: complete
- Run targeted tests/typecheck.
- Update planning docs with findings and results.
- Post important cross-agent/product guidance on TalkTo if appropriate.

Exit criteria:
- Changes are validated and major decisions are documented.

## Result
- Added `TALKTO_PUBLIC_BASE_URL` support so generated invite links and advertised MCP URLs can point at a real public origin instead of localhost/LAN guesses.
- Added admin REST operations for deleting channels and deleting agents, including cleanup of dependent DM channels and channel/message graph data.
- Added admin agent-profile editing in the workspace settings UI, including manual correction of agent provider type metadata.
- Hardened MCP registration so OpenCode evidence wins over bad `claude_code` self-reporting, while still respecting explicit Codex/Cursor registrations.
- Added live invalidation events for `channel_deleted`, `agent_deleted`, and `agent_updated`, plus Cursor invocability/UI parity fixes.

## Validation
- `bun run typecheck` ✅
- `bun test server/tests/mcp.test.ts` ✅
- `bun test server/tests/api.test.ts` ✅
- `cd frontend && bun run test` ✅
- `cd frontend && bun run build` ✅

---

# Task Plan: Context Menus / Test DB Isolation / Messaging Gaps (2026-03-07)

## Goal
Add right-click operator actions for project channels and agents, ensure integration tests never write into the real product database, and assess nearby product gaps such as image paste/forward support.

## Current Phase
Phase 4 - implemented and validated.

## Phases

### Phase 1: Audit current UI and test boot path
Status: complete
- Inspect sidebar channel and agent rendering.
- Inspect server integration tests and server bootstrap side effects.
- Inspect current message schema and frontend rendering for attachment support.

Exit criteria:
- Clear map of where context-menu hooks, test DB leakage, and media limitations live.

### Phase 2: Implement operator context menus
Status: complete
- Add shadcn/Radix context menu primitive to the frontend UI layer.
- Add project-channel right-click actions.
- Add agent right-click actions.

Exit criteria:
- Operators can right-click project channels and agents for destructive or quick actions.

### Phase 3: Isolate integration tests from product state
Status: complete
- Force integration suites onto temp databases.
- Stop `server/src/index.ts` from binding a real port during tests.
- Fix tests that were implicitly relying on a pre-existing onboarded human user.

Exit criteria:
- Combined integration test runs do not touch the real product DB and do not require a live server socket.

### Phase 4: Validate and document
Status: complete
- Run targeted server test suites together.
- Run frontend tests and production build.
- Record deferred product gaps discovered during the audit.

Exit criteria:
- All touched paths are validated and findings are documented.

## Result
- Added shared `ContextMenu` UI primitives and right-click actions for project channels and agents.
- Added isolated temp-db bootstrap for integration tests and disabled live server binding during test imports.
- Fixed API integration tests to onboard their own admin user instead of depending on ambient product data.
- Assessed image paste/forward support and confirmed it is a separate attachment/storage feature, not a small UI-only change.

## Validation
- `bun run typecheck` ✅
- `bun test server/tests/api.test.ts server/tests/auth.test.ts server/tests/mcp.test.ts server/tests/messages-write.test.ts server/tests/ownership.test.ts server/tests/where-chaining.test.ts` ✅
- `cd frontend && bun run test` ✅
- `cd frontend && bun run build` ✅
## Task Plan: Claude Integration Assessment (2026-03-07)

## Goal
Determine why the Claude Code integration is failing in TalkTo by comparing the current server-side wrapper and invocation flow against the actual Claude CLI/SDK behavior on this machine, then identify the concrete breakpoints and any required fixes or setup changes.

## Current Phase
Phase 1 - code and environment audit underway.

## Phases

### Phase 1: Gather failure evidence
Status: in_progress
- Inspect Claude-related backend code paths.
- Extract the provided `Log talkto.docx` contents.
- Validate local Claude CLI presence and shape on this machine.

Exit criteria:
- Concrete failure symptoms and environment facts captured.

### Phase 2: Compare implementation with real Claude behavior
Status: pending
- Inspect `server/src/sdk/claude.ts`, registration flow, and invoker usage.
- Use the local Claude CLI and installed SDK package to validate expected invocation semantics.
- Identify mismatches between TalkTo assumptions and the current Claude tooling.

Exit criteria:
- Root cause candidates narrowed to code bug, setup issue, or both.

### Phase 3: Validate and summarize
Status: pending
- Run focused repro/verification commands where feasible.
- Record findings and any required remediation.
- Post org-relevant Claude integration guidance to TalkTo if feasible.

Exit criteria:
- Assessment is complete and actionable.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| PowerShell profile scripts are blocked in this environment and add noisy output to shell reads | 1 | Switched investigation commands to `login:false` / `-NoProfile` where useful. |
| Claude CLI sandboxed health checks failed with `uv_spawn 'reg' EPERM` | 1 | Re-ran the relevant `claude` commands outside the sandbox for accurate environment validation. |

## Result
- Claude invocation code was patched to pass the SDK-required `allowDangerouslySkipPermissions: true` flag alongside `permissionMode: "bypassPermissions"`.
- Claude prompt failures now mark the session dead locally instead of leaving stale "alive" state behind.
- Claude registration guidance now forbids PID fallbacks and tells agents to use a real Claude session ID only.
- MCP registration now rejects obviously invalid numeric Claude session IDs.
- Validation passed for `server/tests/claude.test.ts`, `server/tests/mcp.test.ts`, and `bun run typecheck`.

---

## Task Plan: Registration Verification / Lifecycle Simplification (2026-03-08)

## Goal
Replace proactive subprocess liveness/ghost assumptions with a simpler lifecycle model: verify provider credentials on `register()`, persist them, assume invocable until a real invoke fails, and keep only failure-time invalidation/offline handling.

## Current Phase
Phase 1 - implementation planning and code-path audit.

## Phases

### Phase 1: Audit current lifecycle model
Status: in_progress
- Inspect registration flow, subprocess provider SDK wrappers, ghost detection, and agent-list/UI semantics.
- Confirm where `alive` state is currently inferred from in-memory state instead of provider-backed verification.
- Identify all places that assume re-registration after TalkTo restart.

Exit criteria:
- Exact code paths and behavioral dependencies are mapped.

### Phase 2: Move verification to registration
Status: pending
- Add provider-specific registration verification for subprocess agents using the same headless resume path TalkTo uses later for invocation.
- Persist verified credentials and enough metadata to resume correctly.
- Return actionable errors when verification fails.

Exit criteria:
- `register()` proves invocability for supported providers before accepting credentials.

### Phase 3: Remove proactive subprocess ghosting
Status: pending
- Remove or bypass proactive liveness checks for `claude_code`, `codex`, and `cursor`.
- Keep OpenCode direct session checks because that provider has a real session API.
- Make discovery rely on persisted credentials unless a real invoke has already invalidated them.

Exit criteria:
- TalkTo restart no longer forces subprocess agents to re-register just to appear invocable.

### Phase 4: Preserve failure-time invalidation and UI semantics
Status: pending
- Keep invocation-time credential clearing and offline transitions on real provider failures.
- Update any UI/status labels or cache logic that still depends on subprocess ghost probing.
- Separate “currently connected over MCP” from “invocable headlessly” where needed.

Exit criteria:
- Operators see stable status semantics without the current ghost false negatives.

### Phase 5: Validate and document
Status: pending
- Run targeted backend tests and typecheck.
- Run at least one live provider resume probe if required to confirm behavior.
- Record findings and final behavior changes in planning files.

Exit criteria:
- Tests pass and the new lifecycle model is documented.

---

## Task Plan: Startup Session Reconciliation / Active-Agent Model (2026-03-08)

## Goal
Make TalkTo treat "active agents" as agents with persisted provider session credentials that can be validated cheaply at startup, regardless of whether an MCP client or terminal is currently connected. Remove stale DB rows automatically on load instead of showing large unreachable backlogs in the UI.

## Current Phase
Phase 1 - provider health primitives and startup path audit.

## Phases

### Phase 1: Define the active-agent invariant
Status: in_progress
- Confirm current startup behavior in server bootstrap and frontend app load.
- Identify all provider-specific non-interactive health checks available without full prompt invocation.
- Decide which cleanup happens at server start vs frontend load-triggered reconciliation.

Exit criteria:
- A precise active-agent model is documented and mapped to concrete code paths.

### Phase 2: Implement provider-specific cheap verification
Status: completed
- OpenCode: use direct session health API.
- Claude Code: verify persisted session metadata from local Claude session storage and project path.
- Codex: verify persisted thread metadata from local Codex storage if available.
- Cursor: verify resumable chat metadata through local state/CLI-safe inspection if available.

Exit criteria:
- TalkTo can cheaply classify persisted agent credentials as reachable or stale without sending a real prompt.

### Phase 3: Reconcile startup state automatically
Status: completed
- Add a backend startup reconciliation pass and/or explicit API hook invoked on initial app load.
- Remove unreachable non-system agents automatically instead of leaving them in the database.
- Ensure logs clearly distinguish MCP session initialization from successful agent registration and startup reconciliation.

Exit criteria:
- Opening TalkTo cleans up stale rows automatically and the agent list reflects only valid stored identities.

### Phase 4: Align frontend semantics
Status: completed
- Remove remaining UI dependence on online/offline terminal concepts.
- Ensure "active" and mentionable agents are driven by verified persisted reachability only.
- Hide or eliminate transitional unreachable sections once startup cleanup is in place.

Exit criteria:
- Frontend matches the new architecture and no longer surfaces the old stale-agent backlog after reconciliation.

### Phase 5: Validate and document
Status: completed
- Run targeted tests and typecheck.
- Update planning files with the final architecture.
- Post the final operational model to TalkTo if feasible.

Exit criteria:
- Reconciliation behavior is validated and documented.

Outcome:
- Cheap verification is implemented for OpenCode, Claude, Codex, and Cursor.
- Startup and app-load reconciliation now auto-delete unreachable non-system agents.
- Frontend startup no longer renders the stale agent backlog before reconciliation completes.
