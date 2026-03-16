/**
 * Agent error tracking — records and queries agent invocation failures.
 *
 * Tracks errors per agent with categorization, frequency analysis,
 * and health scoring based on recent error rates.
 */

export type ErrorCategory = "timeout" | "crash" | "rate_limit" | "auth" | "parse" | "network" | "unknown";

export interface AgentError {
  id: string;
  agentId: string;
  agentName: string;
  category: ErrorCategory;
  message: string;
  channelId?: string;
  occurredAt: string;
}

export interface ErrorStats {
  agentId: string;
  agentName: string;
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  lastErrorAt: string | null;
  errorRate: number; // errors per hour over the window
}

const ERROR_CATEGORIES: ErrorCategory[] = [
  "timeout", "crash", "rate_limit", "auth", "parse", "network", "unknown",
];

/**
 * In-memory agent error store with bounded retention.
 */
export class AgentErrorTracker {
  private errors: AgentError[] = [];
  private maxErrors: number;

  constructor(maxErrors: number = 1000) {
    this.maxErrors = maxErrors;
  }

  /**
   * Record an agent error.
   */
  record(error: Omit<AgentError, "id" | "occurredAt">): AgentError {
    const entry: AgentError = {
      ...error,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    this.errors.push(entry);

    // Evict oldest if over capacity
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    return entry;
  }

  /**
   * Get errors for a specific agent.
   */
  getErrors(agentId: string, limit: number = 50): AgentError[] {
    return this.errors
      .filter((e) => e.agentId === agentId)
      .slice(-limit);
  }

  /**
   * Get all errors within a time window (ms).
   */
  getRecent(windowMs: number = 3600000): AgentError[] {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    return this.errors.filter((e) => e.occurredAt >= cutoff);
  }

  /**
   * Compute error statistics for an agent.
   */
  getStats(agentId: string, agentName: string, windowMs: number = 3600000): ErrorStats {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const agentErrors = this.errors.filter((e) => e.agentId === agentId);
    const recentErrors = agentErrors.filter((e) => e.occurredAt >= cutoff);

    const errorsByCategory = {} as Record<ErrorCategory, number>;
    for (const cat of ERROR_CATEGORIES) {
      errorsByCategory[cat] = 0;
    }
    for (const err of recentErrors) {
      errorsByCategory[err.category] = (errorsByCategory[err.category] || 0) + 1;
    }

    const lastError = agentErrors.length > 0 ? agentErrors[agentErrors.length - 1] : null;
    const hours = windowMs / 3600000;

    return {
      agentId,
      agentName,
      totalErrors: recentErrors.length,
      errorsByCategory,
      lastErrorAt: lastError?.occurredAt ?? null,
      errorRate: recentErrors.length / hours,
    };
  }

  /**
   * Get the total error count.
   */
  size(): number {
    return this.errors.length;
  }

  /**
   * Clear all errors for an agent.
   */
  clearAgent(agentId: string): number {
    const before = this.errors.length;
    this.errors = this.errors.filter((e) => e.agentId !== agentId);
    return before - this.errors.length;
  }

  /**
   * Clear all errors.
   */
  clearAll(): void {
    this.errors = [];
  }
}

/**
 * Classify an error message into a category.
 */
export function classifyError(message: string): ErrorCategory {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout";
  if (lower.includes("crash") || lower.includes("segfault") || lower.includes("killed")) return "crash";
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many")) return "rate_limit";
  if (lower.includes("auth") || lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) return "auth";
  if (lower.includes("parse") || lower.includes("json") || lower.includes("syntax")) return "parse";
  if (lower.includes("network") || lower.includes("econnrefused") || lower.includes("dns") || lower.includes("fetch")) return "network";
  return "unknown";
}

/**
 * Compute a health score (0-100) based on error rate.
 * 0 errors/hr = 100, >=10 errors/hr = 0.
 */
export function healthScore(errorRate: number): number {
  return Math.max(0, Math.round(100 - errorRate * 10));
}

/**
 * Get a health label from a score.
 */
export function healthLabel(score: number): string {
  if (score >= 90) return "healthy";
  if (score >= 70) return "degraded";
  if (score >= 40) return "unhealthy";
  return "critical";
}

/**
 * Format an error for display.
 */
export function formatError(error: AgentError): string {
  const time = new Date(error.occurredAt).toLocaleTimeString();
  return `[${time}] ${error.agentName} — ${error.category}: ${error.message}`;
}
