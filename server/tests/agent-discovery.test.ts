/**
 * Agent discovery service tests.
 *
 * Verifies stale credential cleanup marks agents offline immediately.
 */

import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import "./test-env";
import { DEFAULT_WORKSPACE_ID, getDb } from "../src/db";
import { agents, sessions } from "../src/db/schema";
import { clearStaleCredentials } from "../src/services/agent-discovery";
import { registerOrConnectAgent } from "../src/services/agent-registry";

describe("clearStaleCredentials", () => {
  it("marks the agent offline, clears provider credentials, and ends active sessions", () => {
    const registration = registerOrConnectAgent({
      sessionId: "claude-stale-session-test",
      projectPath: "/tmp/talkto-claude-stale-test",
      agentType: "claude_code",
      workspaceId: DEFAULT_WORKSPACE_ID,
    });

    const agentName = registration.agent_name as string;
    clearStaleCredentials(agentName);

    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.agentName, agentName)).get();

    expect(agent).toBeDefined();
    expect(agent?.status).toBe("offline");
    expect(agent?.providerSessionId).toBeNull();
    expect(agent?.serverUrl).toBeNull();

    const activeSessions = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.agentId, agent!.id), eq(sessions.isActive, 1)))
      .all();

    expect(activeSessions).toHaveLength(0);
  });
});
