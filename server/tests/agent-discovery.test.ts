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
  it("removes the unreachable agent and ends active sessions", () => {
    const registration = registerOrConnectAgent({
      sessionId: "claude-stale-session-test",
      projectPath: "/tmp/talkto-claude-stale-test",
      agentType: "claude_code",
      workspaceId: DEFAULT_WORKSPACE_ID,
    });

    const agentName = registration.agent_name as string;
    const db = getDb();
    const before = db
      .select()
      .from(agents)
      .where(eq(agents.agentName, agentName))
      .get();

    expect(before).toBeDefined();

    clearStaleCredentials(agentName);

    const agent = db.select().from(agents).where(eq(agents.agentName, agentName)).get();
    expect(agent).toBeUndefined();

    const activeSessions = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.agentId, before!.id), eq(sessions.isActive, 1)))
      .all();

    expect(activeSessions).toHaveLength(0);
  });
});
