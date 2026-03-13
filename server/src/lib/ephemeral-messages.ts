/**
 * Ephemeral message utilities — messages that auto-expire after a TTL.
 *
 * Useful for temporary notices, status updates, or sensitive information
 * that shouldn't persist. The cleanup is driven by periodic scanning.
 */

export interface EphemeralConfig {
  /** Default TTL in seconds (default: 300 = 5 minutes) */
  defaultTtlSeconds: number;
  /** Maximum allowed TTL in seconds (default: 86400 = 24 hours) */
  maxTtlSeconds: number;
  /** Minimum allowed TTL in seconds (default: 10) */
  minTtlSeconds: number;
}

export interface EphemeralMessage {
  messageId: string;
  channelId: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface CleanupResult {
  expiredCount: number;
  expiredMessageIds: string[];
  nextExpiryAt: string | null;
}

const DEFAULT_CONFIG: EphemeralConfig = {
  defaultTtlSeconds: 300,
  maxTtlSeconds: 86400,
  minTtlSeconds: 10,
};

/**
 * Validate and clamp a TTL value within configured bounds.
 */
export function clampTtl(ttlSeconds: number, config?: Partial<EphemeralConfig>): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return Math.max(cfg.minTtlSeconds, Math.min(cfg.maxTtlSeconds, Math.round(ttlSeconds)));
}

/**
 * Compute expiry timestamp from creation time and TTL.
 */
export function computeExpiry(createdAt: string, ttlSeconds: number): string {
  const d = new Date(createdAt);
  d.setSeconds(d.getSeconds() + ttlSeconds);
  return d.toISOString();
}

/**
 * Check if a message has expired.
 */
export function isExpired(expiresAt: string, now?: Date): boolean {
  const expiry = new Date(expiresAt).getTime();
  const current = (now ?? new Date()).getTime();
  return current >= expiry;
}

/**
 * Format remaining time until expiry.
 */
export function remainingTime(expiresAt: string, now?: Date): string {
  const expiry = new Date(expiresAt).getTime();
  const current = (now ?? new Date()).getTime();
  const diffMs = expiry - current;

  if (diffMs <= 0) return "expired";

  const seconds = Math.ceil(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

/**
 * In-memory ephemeral message tracker.
 */
export class EphemeralTracker {
  private entries = new Map<string, EphemeralMessage>();
  private config: EphemeralConfig;

  constructor(config?: Partial<EphemeralConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a message as ephemeral. */
  register(messageId: string, channelId: string, ttlSeconds?: number): EphemeralMessage {
    const ttl = clampTtl(ttlSeconds ?? this.config.defaultTtlSeconds, this.config);
    const now = new Date().toISOString();
    const entry: EphemeralMessage = {
      messageId,
      channelId,
      expiresAt: computeExpiry(now, ttl),
      ttlSeconds: ttl,
    };
    this.entries.set(messageId, entry);
    return entry;
  }

  /** Check if a message is ephemeral. */
  isEphemeral(messageId: string): boolean {
    return this.entries.has(messageId);
  }

  /** Find all expired messages for cleanup. */
  findExpired(): CleanupResult {
    const now = new Date();
    const expired: string[] = [];
    let nextExpiry: Date | null = null;

    for (const [id, entry] of this.entries) {
      if (isExpired(entry.expiresAt, now)) {
        expired.push(id);
      } else {
        const exp = new Date(entry.expiresAt);
        if (!nextExpiry || exp < nextExpiry) nextExpiry = exp;
      }
    }

    // Remove expired entries
    for (const id of expired) {
      this.entries.delete(id);
    }

    return {
      expiredCount: expired.length,
      expiredMessageIds: expired,
      nextExpiryAt: nextExpiry?.toISOString() ?? null,
    };
  }

  /** Get count of tracked ephemeral messages. */
  get size(): number {
    return this.entries.size;
  }
}
