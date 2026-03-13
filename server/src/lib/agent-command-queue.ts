/**
 * Agent command queue — queues commands for offline agents and delivers
 * them when the agent comes back online.
 *
 * Useful for scheduling tasks, leaving instructions, or ensuring
 * commands aren't lost when agents disconnect temporarily.
 */

export interface QueuedCommand {
  id: string;
  agentId: string;
  command: string;
  channelId: string;
  queuedBy: string;
  queuedAt: string;
  priority: "normal" | "high";
  status: "pending" | "delivered" | "expired" | "cancelled";
  deliveredAt?: string;
  expiresAt?: string;
}

export interface QueueOptions {
  priority?: "normal" | "high";
  /** ISO timestamp after which the command expires */
  expiresAt?: string;
}

/**
 * In-memory command queue for agents.
 */
export class AgentCommandQueue {
  private commands: QueuedCommand[] = [];

  /** Queue a command for an agent. */
  enqueue(
    agentId: string,
    command: string,
    channelId: string,
    queuedBy: string,
    options?: QueueOptions
  ): QueuedCommand {
    if (!command.trim()) {
      throw new Error("Command cannot be empty");
    }

    const entry: QueuedCommand = {
      id: crypto.randomUUID(),
      agentId,
      command: command.trim(),
      channelId,
      queuedBy,
      queuedAt: new Date().toISOString(),
      priority: options?.priority ?? "normal",
      status: "pending",
      expiresAt: options?.expiresAt,
    };

    this.commands.push(entry);
    return entry;
  }

  /** Get all pending commands for an agent, ordered by priority then time. */
  getPending(agentId: string): QueuedCommand[] {
    this.expireOld();
    return this.commands
      .filter((c) => c.agentId === agentId && c.status === "pending")
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
        return a.queuedAt.localeCompare(b.queuedAt);
      });
  }

  /** Mark commands as delivered (typically when agent comes online). */
  markDelivered(commandIds: string[]): number {
    const now = new Date().toISOString();
    let count = 0;
    for (const cmd of this.commands) {
      if (commandIds.includes(cmd.id) && cmd.status === "pending") {
        cmd.status = "delivered";
        cmd.deliveredAt = now;
        count++;
      }
    }
    return count;
  }

  /** Cancel a pending command. */
  cancel(commandId: string): boolean {
    const cmd = this.commands.find((c) => c.id === commandId);
    if (!cmd || cmd.status !== "pending") return false;
    cmd.status = "cancelled";
    return true;
  }

  /** Get queue depth for an agent. */
  queueDepth(agentId: string): number {
    this.expireOld();
    return this.commands.filter((c) => c.agentId === agentId && c.status === "pending").length;
  }

  /** Get all commands for an agent (any status). */
  getHistory(agentId: string, limit = 50): QueuedCommand[] {
    return this.commands
      .filter((c) => c.agentId === agentId)
      .slice(-limit);
  }

  /** Expire commands past their expiresAt. */
  private expireOld(): void {
    const now = new Date().toISOString();
    for (const cmd of this.commands) {
      if (cmd.status === "pending" && cmd.expiresAt && cmd.expiresAt < now) {
        cmd.status = "expired";
      }
    }
  }
}
