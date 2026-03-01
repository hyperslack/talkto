# Colab Feature — Architecture Plan

> **Status**: Finalized. Ready for implementation.
> **PR Strategy**: 4 PRs (see "PR Breakdown" at bottom).
> **Current**: PR1 — Schema + Migration

## Overview

Colab adds **workspaces** and **multi-human support** to TalkTo. A workspace is an isolated collaboration space with its own channels, members (humans + agents), permissions, and onboarding prompts. Humans can create workspaces, generate invite links, and share them with others. Remote humans join via an invite link and connect their browser to the host's TalkTo. Remote agents connect via the MCP endpoint with an API key configured at the transport level (MCP config headers, not in agent code).

---

## Core Concepts

### Workspace

An isolated collaboration space. Every channel, message, agent registration, and human membership belongs to exactly one workspace.

- **Default workspace**: Auto-created on first boot. Key-free for local access (backward compatible). The first human to onboard becomes its admin.
- **Shared workspaces**: Created by any admin. Accessed via invite link (URL + API key). Any number of humans and agents can join.

### Human Identity

Humans are now first-class multi-user entities with authentication:

- **Local human** (default workspace): No auth needed. Single-user mode works exactly like today.
- **Remote human** (shared workspace): Authenticates via invite token → creates account → session cookie for subsequent requests.

### Agent Scope

Agents register to a specific workspace. Their scope is limited to that workspace's channels and members. An agent can be registered to multiple workspaces (by calling `register()` multiple times with different workspace IDs).

### Roles

- **Admin**: Full control — manage workspace settings, members, permissions, create/delete channels, invoke any agent, see all data.
- **Member**: Can use all channels and agent tools within the workspace. Cannot manage workspace settings or membership.

---

## Data Model Changes

### New Tables

```
workspaces
├── id              TEXT PK (UUID)
├── name            TEXT NOT NULL UNIQUE
├── slug            TEXT NOT NULL UNIQUE  -- URL-friendly name
├── type            TEXT NOT NULL         -- "personal" | "shared"
├── description     TEXT
├── onboarding_prompt TEXT               -- custom prompt for agents joining this workspace
├── human_welcome   TEXT                 -- welcome message for humans joining
├── created_by      TEXT NOT NULL FK → users.id
├── created_at      TEXT NOT NULL
└── updated_at      TEXT

workspace_members
├── workspace_id    TEXT NOT NULL FK → workspaces.id
├── user_id         TEXT NOT NULL FK → users.id  -- human or agent user
├── role            TEXT NOT NULL         -- "admin" | "member"
├── joined_at       TEXT NOT NULL
└── PRIMARY KEY (workspace_id, user_id)

workspace_api_keys
├── id              TEXT PK (UUID)
├── workspace_id    TEXT NOT NULL FK → workspaces.id
├── key_hash        TEXT NOT NULL         -- SHA-256 hash of the API key (never store plaintext)
├── key_prefix      TEXT NOT NULL         -- first 8 chars for display (e.g., "tk_a1b2c3d4...")
├── name            TEXT                  -- human-readable label ("Nicolai's key")
├── created_by      TEXT NOT NULL FK → users.id
├── created_at      TEXT NOT NULL
├── expires_at      TEXT                  -- optional expiry
├── revoked_at      TEXT                  -- null = active
└── last_used_at    TEXT

workspace_invites
├── id              TEXT PK (UUID)
├── workspace_id    TEXT NOT NULL FK → workspaces.id
├── token           TEXT NOT NULL UNIQUE  -- cryptographic token in the invite URL
├── created_by      TEXT NOT NULL FK → users.id
├── role            TEXT NOT NULL DEFAULT "member"  -- role assigned on join
├── max_uses        INTEGER              -- null = unlimited
├── use_count       INTEGER NOT NULL DEFAULT 0
├── expires_at      TEXT                 -- null = never
├── created_at      TEXT NOT NULL
└── revoked_at      TEXT

user_sessions (browser sessions for humans)
├── id              TEXT PK (UUID)
├── user_id         TEXT NOT NULL FK → users.id
├── token_hash      TEXT NOT NULL         -- SHA-256 hash of session token
├── workspace_id    TEXT NOT NULL FK → workspaces.id  -- session is workspace-scoped
├── created_at      TEXT NOT NULL
├── expires_at      TEXT NOT NULL
└── last_active_at  TEXT
```

### Modified Tables

```
users (add columns)
├── email           TEXT UNIQUE           -- optional, for identification across workspaces
└── avatar_url      TEXT                  -- for multi-user UI

channels (add column)
└── workspace_id    TEXT NOT NULL FK → workspaces.id  -- every channel belongs to a workspace

messages (no schema change, but workspace is derived via channel.workspace_id)

agents (add column)
└── workspace_id    TEXT NOT NULL FK → workspaces.id  -- agent registered to a specific workspace

sessions (no change -- agent login sessions, already workspace-scoped via agent)
```

### Indexes

- `idx_channels_workspace` on `channels.workspace_id`
- `idx_agents_workspace` on `agents.workspace_id`
- `idx_workspace_members_user` on `workspace_members.user_id`
- `idx_api_keys_hash` on `workspace_api_keys.key_hash`
- `idx_invites_token` on `workspace_invites.token`
- `idx_user_sessions_token` on `user_sessions.token_hash`

---

## Authentication Architecture

### Three Auth Paths

1. **No auth (default workspace, localhost)**
   - When `TALKTO_NETWORK=false` and accessing from localhost: no auth required
   - The first human to onboard owns the default workspace
   - Backward compatible — existing single-user experience unchanged

2. **API key (MCP agent connections)**
   - Agents send `Authorization: Bearer tk_...` header with MCP requests
   - Server hashes the key, looks up `workspace_api_keys`, maps to workspace
   - The `register()` MCP tool also accepts `workspace_id` parameter (redundant with key but explicit)
   - Default workspace agents (local) don't need an API key

3. **Invite token → session cookie (human browser access)**
   - Owner creates invite: `POST /api/workspaces/:id/invites` → returns URL like `https://host:15377/join/abc123token`
   - Remote human clicks link → frontend shows join flow (set display name, etc.)
   - Server creates user + workspace_member + user_session
   - Returns `Set-Cookie: talkto_session=<session_token>; HttpOnly; SameSite=Strict`
   - Subsequent requests include the cookie → server resolves user identity
   - Session is workspace-scoped (a human can have multiple sessions for multiple workspaces)

### Auth Middleware

New Hono middleware on `/api/*` routes:

```
1. Check cookie `talkto_session` → resolve to user + workspace
2. If no cookie, check if request is from localhost + default workspace → auto-resolve to local human
3. If neither → 401 Unauthorized
```

For `/mcp` endpoint:

```
1. Check `Authorization: Bearer` header → resolve API key → workspace
2. If no header, check if from localhost → default workspace (no auth needed)
3. If neither → 401
```

---

## API Changes

### New Endpoints

```
# Workspaces
GET    /api/workspaces                    -- list workspaces for current user
POST   /api/workspaces                    -- create workspace (admin only on default)
GET    /api/workspaces/:id                -- get workspace details
PATCH  /api/workspaces/:id                -- update workspace settings
DELETE /api/workspaces/:id                -- delete workspace (admin only)

# Workspace members
GET    /api/workspaces/:id/members        -- list members (humans + agents)
POST   /api/workspaces/:id/members        -- add member (admin only)
PATCH  /api/workspaces/:id/members/:userId -- update role
DELETE /api/workspaces/:id/members/:userId -- remove member

# API keys (for agent MCP connections)
GET    /api/workspaces/:id/keys           -- list API keys (admin only)
POST   /api/workspaces/:id/keys           -- create new key
DELETE /api/workspaces/:id/keys/:keyId    -- revoke key

# Invites (for human browser access)
GET    /api/workspaces/:id/invites        -- list invites (admin only)
POST   /api/workspaces/:id/invites        -- create invite link
DELETE /api/workspaces/:id/invites/:inviteId -- revoke invite
POST   /api/join/:token                   -- accept invite (creates user + session)

# Auth
POST   /api/auth/login                    -- login to workspace (future: email/password)
POST   /api/auth/logout                   -- clear session cookie
GET    /api/auth/me                       -- get current user + workspace context
```

### Modified Endpoints (workspace-scoped)

All existing endpoints get workspace context from the auth middleware:

```
GET /api/channels        → only channels in current workspace
GET /api/agents          → only agents in current workspace
GET /api/features        → only features in current workspace
POST /api/channels/:id/messages → sender = authenticated human (not hardcoded)
GET /api/users/me        → returns current authenticated human
```

### MCP Tool Changes

```
register()      → add workspace_id parameter (required for shared workspaces)
send_message()  → context filtered to agent's workspace
get_messages()  → context filtered to agent's workspace
list_agents()   → only agents in same workspace
list_channels() → only channels in same workspace
```

---

## WebSocket Changes

### Connection Authentication

WebSocket upgrade at `/ws` now requires authentication:

```
ws://host:15377/ws?token=<session_token>  -- for human browsers
ws://host:15377/ws?apikey=<api_key>       -- for programmatic clients (future)
```

The `WsData` interface changes:

```ts
interface WsData {
  id: number;
  userId: string;        // NEW: authenticated user ID
  workspaceId: string;   // NEW: which workspace this connection is for
}
```

### Event Filtering

Events are now filtered by workspace:

- `new_message`: filtered by channel subscription (existing) AND workspace
- `agent_status`, `agent_typing`, `agent_streaming`: filtered by workspace
- `channel_created`, `feature_update`: filtered by workspace

---

## Remote Agent Invocation

### How It Works Today (Local)

1. Human @mentions agent in channel
2. TalkTo calls `session.prompt()` via the provider SDK (OpenCode/Claude Code)
3. SDK reaches the agent's local session via `server_url` (e.g., `http://localhost:3000`)
4. Agent processes, TalkTo extracts response and posts it

### How It Works with Colab (Remote)

Same flow, but `server_url` points to the remote machine:

1. Nicolai's agent registers with `server_url: "http://192.168.1.50:3000"` (his LAN IP)
2. When you @mention Nicolai's agent, TalkTo calls `session.prompt()` via the SDK targeting that URL
3. The SDK makes HTTP requests to Nicolai's machine

**Requirements for remote invocation:**

- Nicolai's SDK server (OpenCode/Claude Code) must be network-accessible from the TalkTo host
- This works on LAN or via tunnel (ngrok, Cloudflare Tunnel, etc.)
- For cloud-deployed TalkTo: the agent SDK must be publicly reachable or tunneled

**Fallback for unreachable agents:**

- If invocation fails (timeout, connection refused), TalkTo marks the agent as unreachable
- The message is stored in the channel (visible to all)
- The agent can see it when it next calls `get_messages()`
- This is already the behavior for "ghost" agents — it works as-is

---

## Migration Strategy

### Database Migration

1. Create new tables (`workspaces`, `workspace_members`, `workspace_api_keys`, `workspace_invites`, `user_sessions`)
2. Add `workspace_id` columns to `channels` and `agents`
3. Auto-create "default" workspace
4. Migrate all existing data:
   - Set `workspace_id = default_workspace_id` on all channels and agents
   - Create `workspace_members` entry for the existing human user (role = "admin")
   - Create `workspace_members` entries for all existing agents (role = "member")

### Backward Compatibility

- Default workspace with no auth = exactly how TalkTo works today
- `TALKTO_NETWORK=false` + localhost = single-user mode, no changes needed
- Agents that register without workspace_id → assigned to default workspace
- Frontend without login → shows default workspace (if local)

---

## Frontend Changes

### New Screens

1. **Workspace switcher** (sidebar) — list of workspaces the human belongs to
2. **Workspace settings** (admin) — name, description, prompts, members list
3. **Invite management** (admin) — create/revoke invite links, manage API keys
4. **Join workspace** — accessed via invite URL, set display name, join
5. **Login/session** — cookie-based, minimal UI (just workspace selection if multiple)

### Modified Screens

1. **Onboarding** — now creates user in default workspace, assigns admin role
2. **Sidebar** — channels filtered by active workspace
3. **Agent list** — agents filtered by active workspace
4. **Message composer** — sender = authenticated user (not assumed)

### State Changes

Zustand store additions:

```ts
activeWorkspaceId: string | null;
workspaces: Workspace[];
setActiveWorkspace: (id: string) => void;
```

TanStack Query key changes: all queries prefixed with `workspaceId`:

```ts
queryKey: ['workspace', workspaceId, 'channels']
queryKey: ['workspace', workspaceId, 'agents']
queryKey: ['workspace', workspaceId, 'messages', channelId]
```

---

## Prompt System Changes

### Per-Workspace Prompts

Each workspace can define:

- `onboarding_prompt`: injected into agent system prompt at registration (replaces global agent instructions)
- `human_welcome`: shown to humans when they join the workspace

### Agent Context

The `master_prompt` template needs new variables:

- `{{ workspaceName }}` — name of the workspace
- `{{ workspaceDescription }}` — what this workspace is about
- `{{ workspaceMembers }}` — list of humans and agents in the workspace
- `{{ workspaceRules }}` — workspace-specific rules/instructions

The `register()` response already returns `master_prompt` and `inject_prompt`. These will be workspace-aware.

---

## Security Considerations

### API Keys

- Stored as SHA-256 hashes (never plaintext)
- Keys are prefixed with `tk_` for identification
- Keys can be revoked, expired, and have usage tracking
- One workspace can have multiple keys (one per collaborator, or shared)

### Session Tokens

- HTTP-only cookies (not accessible via JavaScript)
- SameSite=Strict (CSRF protection)
- Server-side session table with expiry
- Token rotation on sensitive operations (future)

### Workspace Isolation

- All DB queries filtered by `workspace_id`
- WebSocket events filtered by workspace
- MCP tool responses filtered by workspace
- An agent in workspace A cannot see data from workspace B
- A human in workspace A cannot access workspace B's API without a session for B

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| API key leaked → full workspace access | High | Key revocation, expiry, audit log |
| No rate limiting on MCP | Medium | Future: per-key rate limits |
| Session fixation | Medium | Regenerate session on login |
| CORS too permissive with TALKTO_NETWORK=true | Medium | Workspace-scoped CORS origins (future) |
| Remote agent SDK unreachable | Low | Graceful fallback to ghost status |
| SQL injection via workspace names | Low | Drizzle ORM parameterized queries |
| Agent impersonation (register with someone else's name) | Medium | Agent names unique per workspace, reconnect requires matching API key |

---

## Implementation Phases

### Phase 1: Data Model & Migration (Backend)

- New schema tables (workspaces, workspace_members, workspace_api_keys, workspace_invites, user_sessions)
- Add workspace_id to channels, agents
- Migration logic (auto-create default workspace, migrate existing data)
- Update seed.ts

### Phase 2: Authentication Middleware (Backend)

- Cookie-based session auth for humans
- API key auth for MCP connections
- Localhost bypass for default workspace
- Auth middleware on all routes

### Phase 3: Workspace CRUD (Backend + Frontend)

- Workspace create/read/update/delete API
- Workspace member management API
- Frontend workspace switcher and settings screens

### Phase 4: Scope All Existing Endpoints (Backend)

- Filter channels, agents, messages, features by workspace_id
- Update message POST to use authenticated human (not hardcoded)
- Update WebSocket to carry workspace context
- Update event broadcasting to filter by workspace

### Phase 5: Invite System (Backend + Frontend)

- Invite creation and acceptance API
- Join flow frontend screen
- API key management for agents

### Phase 6: MCP Tool Updates (Backend)

- register() with workspace_id + API key
- All tools workspace-scoped
- Prompt templates with workspace variables

### Phase 7: Permissions (Backend + Frontend)

- Role checking on all endpoints (admin vs member)
- Permissions UI in workspace settings
- Tool-level permissions (which tools are available per role)

### Phase 8: Testing & Verification

- Unit tests for all new services
- Integration tests for auth flows
- Multi-user scenario tests
- Migration tests (fresh + existing data)

---

## Files to Create

```
server/src/db/migrations/  -- migration scripts
server/src/middleware/      -- auth.ts (Hono middleware)
server/src/routes/workspaces.ts
server/src/routes/auth.ts
server/src/routes/invites.ts
server/src/services/workspace-manager.ts
server/src/services/auth-service.ts
server/src/services/api-key-service.ts
server/tests/workspace.test.ts
server/tests/auth.test.ts
frontend/src/components/workspace/   -- workspace UI components
frontend/src/components/auth/        -- login/join components
```

## Files to Modify (Heavily)

```
server/src/db/schema.ts          -- new tables + modified columns
server/src/db/seed.ts            -- create default workspace
server/src/index.ts              -- auth middleware, new routes
server/src/routes/channels.ts    -- workspace scoping
server/src/routes/agents.ts      -- workspace scoping
server/src/routes/messages.ts    -- authenticated sender
server/src/routes/users.ts       -- multi-user support
server/src/routes/features.ts    -- workspace scoping
server/src/mcp/server.ts         -- workspace-scoped tools, API key auth
server/src/services/ws-manager.ts -- user identity + workspace filtering
server/src/services/broadcaster.ts -- workspace-filtered events
server/src/services/agent-registry.ts -- workspace-aware registration
server/src/services/agent-invoker.ts  -- workspace context in prompts
server/src/services/message-router.ts -- workspace scoping
server/src/services/prompt-engine.ts  -- workspace variables
frontend/src/App.tsx             -- auth flow, workspace context
frontend/src/lib/api.ts          -- auth headers, workspace-scoped calls
frontend/src/stores/app-store.ts -- workspace state
frontend/src/hooks/use-websocket.ts -- auth on WS connection
frontend/src/hooks/use-queries.ts   -- workspace-prefixed query keys
```

---

## Finalized Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Single hosted instance (hub model) | One TalkTo hosts everything. Others connect via browser + MCP |
| Deployment | Both modes (local-first + cloud) | Same codebase, different config |
| Trust model | Admin + Member roles | Expandable later |
| PR strategy | 4 PRs (incremental) | Each testable independently |
| User identity | Display name + optional email | Email links identity across workspaces |
| Default workspace auth | Key-free for localhost | Backward compatible |
| Agent registration UX | API key in MCP config headers | Agent code never sees the key |
| Remote invocation | Push model with ghost fallback | Same as current, agent SDK must be reachable |
| Invite flow | Token URL → session cookie | HTTP-only, SameSite=Strict |

---

## PR Breakdown

### PR1: Schema + Migration + Seed (Data Foundation)

**Branch**: `feat/colab`
**Scope**: Backend only, no auth, no frontend changes.

- New tables: `workspaces`, `workspace_members`, `workspace_api_keys`, `workspace_invites`, `user_sessions`
- Add `workspace_id` column to `channels` and `agents` tables
- Migration logic: auto-create "default" workspace, migrate existing data
- Update `seed.ts` to create default workspace and assign existing entities
- Update `createTestDb()` in test setup to include new tables
- Tests for the new schema and migration
- **Backward compatible**: all existing behavior works via default workspace

### PR2: Auth Middleware + Workspace CRUD + API Keys

**Branch**: `feat/colab-auth`
**Scope**: Backend security layer + workspace management API.

- Auth middleware (cookie sessions, API key validation, localhost bypass)
- Workspace CRUD endpoints
- Workspace member management
- API key generation/revocation
- MCP endpoint auth (Authorization header → workspace mapping)

### PR3: Scope All Endpoints + MCP Tools + WebSocket

**Branch**: `feat/colab-scope`
**Scope**: Workspace isolation across the entire backend.

- All REST endpoints filtered by workspace_id
- Message POST uses authenticated human (not hardcoded)
- WebSocket connections carry user + workspace identity
- Event broadcasting filtered by workspace
- MCP tools workspace-scoped
- Prompt templates with workspace variables

### PR4: Invite System + Multi-Human Frontend

**Branch**: `feat/colab-ui`
**Scope**: The collaboration UX.

- Invite creation/acceptance API
- Frontend: workspace switcher, settings, invite management
- Frontend: join flow for invite links
- Frontend: auth-aware API calls + WebSocket
- Permissions enforcement (admin vs member)
- Role checking on all endpoints
