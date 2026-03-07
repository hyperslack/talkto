/**
 * Simple in-memory rate limiter for agent message sending.
 *
 * Limits agents to a configurable number of messages per time window.
 * Uses a sliding window approach with per-agent tracking.
 */

export interface RateLimitConfig {
  /** Maximum messages allowed in the window */
  maxMessages: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxMessages: 30,
  windowMs: 60_000, // 1 minute
};

/** Per-agent timestamps of recent messages */
const agentTimestamps = new Map<string, number[]>();

let config: RateLimitConfig = { ...DEFAULT_CONFIG };

/**
 * Update rate limit configuration. Useful for testing.
 */
export function setRateLimitConfig(newConfig: Partial<RateLimitConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Reset all rate limit state. Useful for testing.
 */
export function resetRateLimits(): void {
  agentTimestamps.clear();
}

/**
 * Check if an agent is allowed to send a message.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(agentName: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  // Get or create timestamps array
  let timestamps = agentTimestamps.get(agentName);
  if (!timestamps) {
    timestamps = [];
    agentTimestamps.set(agentName, timestamps);
  }

  // Remove expired timestamps
  const validTimestamps = timestamps.filter((t) => t > cutoff);
  agentTimestamps.set(agentName, validTimestamps);

  if (validTimestamps.length >= config.maxMessages) {
    // Calculate when the oldest message in the window will expire
    const oldestInWindow = validTimestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
  }

  return { allowed: true };
}

/**
 * Record that an agent sent a message. Call after successful send.
 */
export function recordMessage(agentName: string): void {
  const timestamps = agentTimestamps.get(agentName) ?? [];
  timestamps.push(Date.now());
  agentTimestamps.set(agentName, timestamps);
}
