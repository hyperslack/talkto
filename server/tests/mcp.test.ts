/**
 * MCP tool smoke tests — tests the agent-facing MCP interface.
 *
 * Tests MCP tools by sending JSON-RPC requests to the /mcp endpoint
 * via the Hono app (streamable HTTP transport).
 *
 * Flow: POST /mcp (initialize) → get session ID → POST /mcp (tool calls)
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8096";
  const mod = await import("../src/index");
  app = mod.app;
});

// ---------------------------------------------------------------------------
// MCP JSON-RPC helpers
// ---------------------------------------------------------------------------

/** Send an MCP JSON-RPC request and return the response + session ID. */
async function mcpRequest(
  method: string,
  params: Record<string, unknown> = {},
  sessionId?: string,
  id: number = 1
): Promise<{ status: number; body: unknown; sessionId: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const jsonRpcBody = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(jsonRpcBody),
  });

  const res = await app.fetch(request);
  const newSessionId = res.headers.get("mcp-session-id");

  let body: unknown;
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    body = await res.json();
  } else if (contentType.includes("text/event-stream")) {
    // Parse SSE response — collect all JSON-RPC responses from the stream
    const text = await res.text();
    const lines = text.split("\n");
    const dataLines = lines
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6));
    if (dataLines.length > 0) {
      // Return the last data event (usually the response)
      body = JSON.parse(dataLines[dataLines.length - 1]);
    } else {
      body = { raw: text };
    }
  } else {
    body = await res.text();
  }

  return {
    status: res.status,
    body,
    sessionId: newSessionId ?? sessionId ?? null,
  };
}

/** Initialize an MCP session and return the session ID. */
async function initMcpSession(): Promise<string> {
  const { status, body, sessionId } = await mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });

  expect(status).toBe(200);
  expect(sessionId).toBeDefined();
  expect(sessionId).not.toBeNull();

  // Send initialized notification
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const notifyReq = new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  await app.fetch(notifyReq);

  return sessionId!;
}

/** Call an MCP tool and return the parsed result. */
async function callTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown> = {},
  id: number = 2
): Promise<{ result: unknown; error?: unknown }> {
  const { status, body } = await mcpRequest(
    "tools/call",
    { name: toolName, arguments: args },
    sessionId,
    id
  );

  const response = body as {
    result?: { content?: Array<{ text: string }> };
    error?: unknown;
  };

  if (response.error) {
    return { result: null, error: response.error };
  }

  if (response.result?.content?.[0]?.text) {
    try {
      return { result: JSON.parse(response.result.content[0].text) };
    } catch {
      return { result: response.result.content[0].text };
    }
  }

  return { result: response.result };
}

// ---------------------------------------------------------------------------
// MCP Session Initialization
// ---------------------------------------------------------------------------

describe("MCP — Session Lifecycle", () => {
  it("initializes an MCP session successfully", async () => {
    const sessionId = await initMcpSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
  });

  it("lists available tools", async () => {
    const sessionId = await initMcpSession();
    const { body } = await mcpRequest("tools/list", {}, sessionId, 2);

    const response = body as { result?: { tools?: Array<{ name: string }> } };
    expect(response.result).toBeDefined();
    expect(response.result!.tools).toBeDefined();
    expect(Array.isArray(response.result!.tools)).toBe(true);

    const toolNames = response.result!.tools!.map((t) => t.name);
    // Verify core tools exist
    expect(toolNames).toContain("register");
    expect(toolNames).toContain("send_message");
    expect(toolNames).toContain("get_messages");
    expect(toolNames).toContain("list_channels");
    expect(toolNames).toContain("list_agents");
    expect(toolNames).toContain("create_channel");
    expect(toolNames).toContain("heartbeat");
    expect(toolNames).toContain("search_messages");
    expect(toolNames).toContain("edit_message");
    expect(toolNames).toContain("react_message");
  });
});

// ---------------------------------------------------------------------------
// Register tool
// ---------------------------------------------------------------------------

describe("MCP — register", () => {
  it("registers a new agent", async () => {
    const sessionId = await initMcpSession();
    const { result } = await callTool(sessionId, "register", {
      session_id: "test-session-001",
      project_path: "/tmp/test-project",
      agent_type: "claude_code",
    });

    const data = result as Record<string, unknown>;
    expect(data.agent_name).toBeDefined();
    expect(typeof data.agent_name).toBe("string");
    // New registrations return master_prompt + project_channel (no status field)
    expect(data.master_prompt).toBeDefined();
  });

  it("reconnects with an existing agent name", async () => {
    const sessionId = await initMcpSession();

    // First register to get a name
    const { result: first } = await callTool(sessionId, "register", {
      session_id: "test-session-002",
      project_path: "/tmp/test-project",
      agent_type: "claude_code",
    });
    const agentName = (first as Record<string, unknown>).agent_name as string;

    // Re-register with the same name in a new MCP session
    const sessionId2 = await initMcpSession();
    const { result: second } = await callTool(sessionId2, "register", {
      session_id: "test-session-003",
      project_path: "/tmp/test-project",
      agent_name: agentName,
      agent_type: "claude_code",
    });

    const data = second as Record<string, unknown>;
    expect(data.agent_name).toBe(agentName);
  });

  it("returns error for empty session_id", async () => {
    const sessionId = await initMcpSession();
    const { result } = await callTool(sessionId, "register", {
      session_id: "",
      project_path: "/tmp/test-project",
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeDefined();
    expect(typeof data.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Tools that require registration
// ---------------------------------------------------------------------------

describe("MCP — Tools Require Registration", () => {
  it("send_message fails without registration", async () => {
    const sessionId = await initMcpSession();
    const { result } = await callTool(sessionId, "send_message", {
      channel: "#general",
      content: "Should fail",
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBe("Not registered. Call register first.");
  });

  it("get_messages fails without registration", async () => {
    const sessionId = await initMcpSession();
    const { result } = await callTool(sessionId, "get_messages", {});

    const data = result as Record<string, unknown>;
    expect(data.error).toBe("Not registered. Call register first.");
  });

  it("heartbeat fails without registration", async () => {
    const sessionId = await initMcpSession();
    const { result } = await callTool(sessionId, "heartbeat", {});

    const data = result as Record<string, unknown>;
    expect(data.error).toBe("Not registered. Call register first.");
  });
});

// ---------------------------------------------------------------------------
// Full workflow: register → send → get
// ---------------------------------------------------------------------------

describe("MCP — Full Agent Workflow", () => {
  let sessionId: string;
  let agentName: string;

  beforeAll(async () => {
    sessionId = await initMcpSession();

    // Register the agent
    const { result } = await callTool(sessionId, "register", {
      session_id: "test-workflow-session",
      project_path: "/tmp/workflow-test",
      agent_type: "claude_code",
    });
    agentName = (result as Record<string, unknown>).agent_name as string;
  });

  it("sends a message to #general", async () => {
    const { result } = await callTool(sessionId, "send_message", {
      channel: "#general",
      content: `MCP smoke test from ${agentName}`,
    });

    const data = result as Record<string, unknown>;
    // Success means we get back a message ID
    expect(data.error).toBeUndefined();
    expect(data.message_id ?? data.id).toBeDefined();
  });

  it("gets messages from #general", async () => {
    const { result } = await callTool(sessionId, "get_messages", {
      channel: "#general",
      limit: 5,
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
    // Should return messages array or a structured response
    const msgs = (data.messages ?? data) as unknown[];
    expect(Array.isArray(msgs)).toBe(true);
  });

  it("lists channels", async () => {
    const { result } = await callTool(sessionId, "list_channels", {});

    // list_channels can return an array or object with channels
    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);
    } else {
      const data = result as Record<string, unknown>;
      expect(data.error).toBeUndefined();
    }
  });

  it("lists agents", async () => {
    const { result } = await callTool(sessionId, "list_agents", {});

    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);
      // Our newly registered agent should be in the list
      // listAllAgents uses "name" not "agent_name"
      const found = result.find(
        (a: Record<string, unknown>) => a.name === agentName
      );
      expect(found).toBeDefined();
    } else {
      const data = result as Record<string, unknown>;
      expect(data.error).toBeUndefined();
    }
  });

  it("updates agent profile", async () => {
    const { result } = await callTool(sessionId, "update_profile", {
      description: "I am a test agent",
      personality: "methodical",
      current_task: "Running smoke tests",
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
  });

  it("sends a heartbeat", async () => {
    const { result } = await callTool(sessionId, "heartbeat", {});

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
    expect(data.status).toBe("ok");
  });

  it("gets feature requests", async () => {
    const { result } = await callTool(
      sessionId,
      "get_feature_requests",
      {}
    );

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
    // Should have features (seeded) or be an empty hint
    expect(data.features ?? data.hint).toBeDefined();
  });

  it("searches messages", async () => {
    const { result } = await callTool(sessionId, "search_messages", {
      query: "MCP smoke test",
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
  });

  it("creates a channel", async () => {
    const channelName = `test-mcp-${Date.now()}`;
    const { result } = await callTool(sessionId, "create_channel", {
      name: channelName,
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
  });

  it("disconnects cleanly", async () => {
    // Use a separate session for disconnect test to not break other tests
    const disconnectSession = await initMcpSession();
    const { result: regResult } = await callTool(
      disconnectSession,
      "register",
      {
        session_id: "test-disconnect-session",
        project_path: "/tmp/disconnect-test",
        agent_type: "claude_code",
      }
    );

    const disconnectName = (regResult as Record<string, unknown>)
      .agent_name as string;

    const { result } = await callTool(disconnectSession, "disconnect", {
      agent_name: disconnectName,
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
    expect(data.status).toBe("disconnected");
  });
});

// ---------------------------------------------------------------------------
// Feature request workflow
// ---------------------------------------------------------------------------

describe("MCP — Feature Requests", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await initMcpSession();
    await callTool(sessionId, "register", {
      session_id: "test-features-session",
      project_path: "/tmp/features-test",
      agent_type: "claude_code",
    });
  });

  it("creates a feature request", async () => {
    const { result } = await callTool(sessionId, "create_feature_request", {
      title: "MCP Test Feature",
      description: "This feature was created by the MCP smoke test",
    });

    const data = result as Record<string, unknown>;
    expect(data.error).toBeUndefined();
    expect(data.id ?? data.feature_id).toBeDefined();
  });

  it("votes on a feature request", async () => {
    // Get existing features to find one to vote on
    const { result: features } = await callTool(
      sessionId,
      "get_feature_requests",
      {}
    );

    const data = features as Record<string, unknown>;
    const featureList = data.features as Array<Record<string, unknown>>;

    if (featureList && featureList.length > 0) {
      const featureId = featureList[0].id as string;
      const { result } = await callTool(sessionId, "vote_feature", {
        feature_id: featureId,
        vote: 1,
      });

      const voteData = result as Record<string, unknown>;
      expect(voteData.error).toBeUndefined();
    }
  });
});
