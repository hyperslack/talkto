/**
 * Message scheduling queue — schedule messages for future delivery.
 *
 * Provides an in-memory queue for scheduling messages to be sent at a
 * future time. Supports create, cancel, list, and fire-due operations.
 */

export interface ScheduledMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  scheduledAt: string; // ISO 8601
  createdAt: string;
  status: "pending" | "delivered" | "cancelled";
  deliveredAt?: string;
}

export interface CreateScheduledInput {
  channelId: string;
  senderId: string;
  content: string;
  scheduledAt: string;
}

let idCounter = 0;

export class MessageSchedulingQueue {
  private queue: Map<string, ScheduledMessage> = new Map();

  /** Schedule a message for future delivery. */
  schedule(input: CreateScheduledInput): ScheduledMessage {
    if (!input.content || input.content.trim().length === 0) {
      throw new Error("Content cannot be empty");
    }
    const now = new Date();
    const scheduledDate = new Date(input.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error("Invalid scheduledAt date");
    }
    if (scheduledDate <= now) {
      throw new Error("scheduledAt must be in the future");
    }

    const id = `sched_${++idCounter}`;
    const msg: ScheduledMessage = {
      id,
      channelId: input.channelId,
      senderId: input.senderId,
      content: input.content.trim(),
      scheduledAt: input.scheduledAt,
      createdAt: now.toISOString(),
      status: "pending",
    };
    this.queue.set(id, msg);
    return msg;
  }

  /** Cancel a scheduled message. Returns true if found and cancelled. */
  cancel(id: string): boolean {
    const msg = this.queue.get(id);
    if (!msg || msg.status !== "pending") return false;
    msg.status = "cancelled";
    return true;
  }

  /** Get a scheduled message by ID. */
  get(id: string): ScheduledMessage | undefined {
    return this.queue.get(id);
  }

  /** List pending messages for a channel, sorted by scheduledAt. */
  listPending(channelId?: string): ScheduledMessage[] {
    const results: ScheduledMessage[] = [];
    for (const msg of this.queue.values()) {
      if (msg.status !== "pending") continue;
      if (channelId && msg.channelId !== channelId) continue;
      results.push(msg);
    }
    return results.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  /** List all messages for a sender. */
  listBySender(senderId: string): ScheduledMessage[] {
    const results: ScheduledMessage[] = [];
    for (const msg of this.queue.values()) {
      if (msg.senderId === senderId) results.push(msg);
    }
    return results.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  /** Find and mark all messages due for delivery. Returns the delivered messages. */
  fireDue(now?: Date): ScheduledMessage[] {
    const cutoff = (now ?? new Date()).toISOString();
    const due: ScheduledMessage[] = [];
    for (const msg of this.queue.values()) {
      if (msg.status === "pending" && msg.scheduledAt <= cutoff) {
        msg.status = "delivered";
        msg.deliveredAt = cutoff;
        due.push(msg);
      }
    }
    return due;
  }

  /** Count pending messages. */
  pendingCount(): number {
    let count = 0;
    for (const msg of this.queue.values()) {
      if (msg.status === "pending") count++;
    }
    return count;
  }

  /** Purge all cancelled and delivered messages. Returns count purged. */
  purge(): number {
    let count = 0;
    for (const [id, msg] of this.queue.entries()) {
      if (msg.status === "cancelled" || msg.status === "delivered") {
        this.queue.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Clear the queue entirely (for testing). */
  clear(): void {
    this.queue.clear();
  }
}
