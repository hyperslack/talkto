/**
 * Workspace-level rate limiter with per-user and global limits.
 *
 * Uses a sliding window approach. Configurable per workspace to prevent
 * abuse from any single user or from the workspace as a whole.
 */

export interface RateLimitConfig {
  /** Max requests per user within the window (default: 60) */
  perUserLimit: number;
  /** Max requests across all users within the window (default: 300) */
  globalLimit: number;
  /** Window duration in milliseconds (default: 60000 = 1 min) */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number | null;
  scope: "user" | "global" | null;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perUserLimit: 60,
  globalLimit: 300,
  windowMs: 60_000,
};

export class WorkspaceRateLimiter {
  private config: RateLimitConfig;
  private userWindows = new Map<string, number[]>();
  private globalWindow: number[] = [];

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Check and consume a rate limit token. */
  check(userId: string): RateLimitResult {
    const now = Date.now();
    this.prune(now);

    // Check global limit first
    if (this.globalWindow.length >= this.config.globalLimit) {
      const oldest = this.globalWindow[0];
      const retryAfterMs = (oldest + this.config.windowMs) - now;
      return {
        allowed: false,
        remaining: 0,
        limit: this.config.globalLimit,
        retryAfterMs: Math.max(0, retryAfterMs),
        scope: "global",
      };
    }

    // Check per-user limit
    const userWindow = this.userWindows.get(userId) ?? [];
    if (userWindow.length >= this.config.perUserLimit) {
      const oldest = userWindow[0];
      const retryAfterMs = (oldest + this.config.windowMs) - now;
      return {
        allowed: false,
        remaining: 0,
        limit: this.config.perUserLimit,
        retryAfterMs: Math.max(0, retryAfterMs),
        scope: "user",
      };
    }

    // Allow and record
    this.globalWindow.push(now);
    userWindow.push(now);
    this.userWindows.set(userId, userWindow);

    return {
      allowed: true,
      remaining: this.config.perUserLimit - userWindow.length,
      limit: this.config.perUserLimit,
      retryAfterMs: null,
      scope: null,
    };
  }

  /** Get current usage stats. */
  stats(): { globalUsage: number; userCount: number; config: RateLimitConfig } {
    this.prune(Date.now());
    return {
      globalUsage: this.globalWindow.length,
      userCount: this.userWindows.size,
      config: { ...this.config },
    };
  }

  /** Get usage for a specific user. */
  userUsage(userId: string): number {
    this.prune(Date.now());
    return (this.userWindows.get(userId) ?? []).length;
  }

  /** Reset all rate limit counters. */
  reset(): void {
    this.userWindows.clear();
    this.globalWindow = [];
  }

  /** Update configuration. */
  updateConfig(patch: Partial<RateLimitConfig>): void {
    Object.assign(this.config, patch);
  }

  private prune(now: number): void {
    const cutoff = now - this.config.windowMs;
    this.globalWindow = this.globalWindow.filter((t) => t > cutoff);
    for (const [userId, window] of this.userWindows) {
      const pruned = window.filter((t) => t > cutoff);
      if (pruned.length === 0) {
        this.userWindows.delete(userId);
      } else {
        this.userWindows.set(userId, pruned);
      }
    }
  }
}
