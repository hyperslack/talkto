/**
 * Agent invocation cooldown tracker.
 *
 * Prevents spamming agent invocations by enforcing per-user cooldowns
 * on @agent mentions. Configurable per agent with different cooldown periods.
 */

export interface CooldownConfig {
  /** Default cooldown in milliseconds */
  defaultMs: number;
  /** Per-agent cooldown overrides */
  agentOverrides: Map<string, number>;
}

export interface CooldownEntry {
  userId: string;
  agentName: string;
  invokedAt: number;
  cooldownMs: number;
}

export interface CooldownCheck {
  allowed: boolean;
  retryAfterMs: number;
  /** When the cooldown expires (epoch ms) */
  expiresAt: number;
}

/**
 * In-memory cooldown tracker for agent invocations.
 */
export class InvocationCooldownTracker {
  private entries: Map<string, CooldownEntry> = new Map(); // "userId:agentName" → entry
  private config: CooldownConfig;

  constructor(config?: Partial<CooldownConfig>) {
    this.config = {
      defaultMs: config?.defaultMs ?? 10_000, // 10s default
      agentOverrides: config?.agentOverrides ?? new Map(),
    };
  }

  private key(userId: string, agentName: string): string {
    return `${userId}:${agentName}`;
  }

  private getCooldownMs(agentName: string): number {
    return this.config.agentOverrides.get(agentName) ?? this.config.defaultMs;
  }

  /**
   * Check if an invocation is allowed and record it if so.
   */
  check(userId: string, agentName: string, now: number = Date.now()): CooldownCheck {
    const k = this.key(userId, agentName);
    const entry = this.entries.get(k);
    const cooldownMs = this.getCooldownMs(agentName);

    if (entry) {
      const elapsed = now - entry.invokedAt;
      if (elapsed < entry.cooldownMs) {
        const retryAfterMs = entry.cooldownMs - elapsed;
        return {
          allowed: false,
          retryAfterMs,
          expiresAt: entry.invokedAt + entry.cooldownMs,
        };
      }
    }

    // Record invocation
    this.entries.set(k, { userId, agentName, invokedAt: now, cooldownMs });
    return { allowed: true, retryAfterMs: 0, expiresAt: now + cooldownMs };
  }

  /**
   * Reset cooldown for a specific user-agent pair.
   */
  reset(userId: string, agentName: string): void {
    this.entries.delete(this.key(userId, agentName));
  }

  /**
   * Reset all cooldowns for a user.
   */
  resetUser(userId: string): number {
    let count = 0;
    for (const [k] of this.entries) {
      if (k.startsWith(`${userId}:`)) {
        this.entries.delete(k);
        count++;
      }
    }
    return count;
  }

  /**
   * Set a per-agent cooldown override.
   */
  setAgentCooldown(agentName: string, cooldownMs: number): void {
    this.config.agentOverrides.set(agentName, cooldownMs);
  }

  /**
   * Purge expired entries to free memory.
   */
  purgeExpired(now: number = Date.now()): number {
    let purged = 0;
    for (const [k, entry] of this.entries) {
      if (now - entry.invokedAt >= entry.cooldownMs) {
        this.entries.delete(k);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Get the number of active cooldown entries.
   */
  get size(): number {
    return this.entries.size;
  }
}

/**
 * Format cooldown remaining time for user display.
 */
export function formatCooldown(retryAfterMs: number): string {
  if (retryAfterMs <= 0) return "ready";
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}
