import { describe, it, expect } from "bun:test";
import { AgentCommandQueue } from "../src/lib/agent-command-queue";

describe("AgentCommandQueue", () => {
  it("enqueues and retrieves pending commands", () => {
    const q = new AgentCommandQueue();
    const cmd = q.enqueue("agent1", "run tests", "ch1", "user1");
    expect(cmd.status).toBe("pending");
    expect(cmd.command).toBe("run tests");
    
    const pending = q.getPending("agent1");
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(cmd.id);
  });

  it("rejects empty commands", () => {
    const q = new AgentCommandQueue();
    expect(() => q.enqueue("agent1", "  ", "ch1", "user1")).toThrow("Command cannot be empty");
  });

  it("returns empty for unknown agents", () => {
    const q = new AgentCommandQueue();
    expect(q.getPending("nobody")).toEqual([]);
  });

  it("sorts high priority commands first", () => {
    const q = new AgentCommandQueue();
    q.enqueue("agent1", "low priority", "ch1", "user1", { priority: "normal" });
    q.enqueue("agent1", "high priority", "ch1", "user1", { priority: "high" });

    const pending = q.getPending("agent1");
    expect(pending[0].command).toBe("high priority");
    expect(pending[1].command).toBe("low priority");
  });

  it("marks commands as delivered", () => {
    const q = new AgentCommandQueue();
    const cmd = q.enqueue("agent1", "do thing", "ch1", "user1");
    const count = q.markDelivered([cmd.id]);
    expect(count).toBe(1);
    expect(q.getPending("agent1").length).toBe(0);
  });

  it("cancels pending commands", () => {
    const q = new AgentCommandQueue();
    const cmd = q.enqueue("agent1", "cancel me", "ch1", "user1");
    expect(q.cancel(cmd.id)).toBe(true);
    expect(q.getPending("agent1").length).toBe(0);
  });

  it("cannot cancel already delivered commands", () => {
    const q = new AgentCommandQueue();
    const cmd = q.enqueue("agent1", "delivered", "ch1", "user1");
    q.markDelivered([cmd.id]);
    expect(q.cancel(cmd.id)).toBe(false);
  });

  it("expires commands past their expiresAt", () => {
    const q = new AgentCommandQueue();
    const pastTime = new Date(Date.now() - 10_000).toISOString();
    q.enqueue("agent1", "expired cmd", "ch1", "user1", { expiresAt: pastTime });
    expect(q.getPending("agent1").length).toBe(0);
  });

  it("tracks queue depth", () => {
    const q = new AgentCommandQueue();
    q.enqueue("agent1", "cmd1", "ch1", "user1");
    q.enqueue("agent1", "cmd2", "ch1", "user1");
    q.enqueue("agent2", "cmd3", "ch1", "user1");
    expect(q.queueDepth("agent1")).toBe(2);
    expect(q.queueDepth("agent2")).toBe(1);
  });

  it("returns history for an agent", () => {
    const q = new AgentCommandQueue();
    const cmd = q.enqueue("agent1", "historic", "ch1", "user1");
    q.markDelivered([cmd.id]);
    q.enqueue("agent1", "pending", "ch1", "user1");

    const history = q.getHistory("agent1");
    expect(history.length).toBe(2);
  });
});
