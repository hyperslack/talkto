/**
 * Workspace usage quota tracking utilities.
 *
 * Track resource usage against configurable limits for workspaces,
 * enabling fair usage enforcement and capacity planning.
 */

export interface QuotaConfig {
  maxChannels: number;
  maxMembers: number;
  maxAgents: number;
  maxMessagesPerDay: number;
  maxFileSizeMb: number;
}

export interface UsageSnapshot {
  channels: number;
  members: number;
  agents: number;
  messagesToday: number;
  storageUsedMb: number;
}

export interface QuotaCheck {
  resource: string;
  current: number;
  limit: number;
  used: number; // percentage 0-100
  remaining: number;
  exceeded: boolean;
}

/** Default free-tier quota. */
export const DEFAULT_QUOTA: QuotaConfig = {
  maxChannels: 50,
  maxMembers: 100,
  maxAgents: 10,
  maxMessagesPerDay: 10000,
  maxFileSizeMb: 25,
};

/**
 * Check a single resource against its limit.
 */
export function checkResource(
  resource: string,
  current: number,
  limit: number
): QuotaCheck {
  const used = limit > 0 ? Math.round((current / limit) * 100) : 100;
  return {
    resource,
    current,
    limit,
    used: Math.min(used, 100),
    remaining: Math.max(limit - current, 0),
    exceeded: current >= limit,
  };
}

/**
 * Check all quotas for a workspace.
 */
export function checkAllQuotas(
  usage: UsageSnapshot,
  config: QuotaConfig = DEFAULT_QUOTA
): QuotaCheck[] {
  return [
    checkResource("channels", usage.channels, config.maxChannels),
    checkResource("members", usage.members, config.maxMembers),
    checkResource("agents", usage.agents, config.maxAgents),
    checkResource("messages_per_day", usage.messagesToday, config.maxMessagesPerDay),
  ];
}

/**
 * Check if any quota is exceeded.
 */
export function isAnyQuotaExceeded(
  usage: UsageSnapshot,
  config: QuotaConfig = DEFAULT_QUOTA
): boolean {
  return checkAllQuotas(usage, config).some((q) => q.exceeded);
}

/**
 * Get the most-used quota (closest to limit).
 */
export function getMostUsedQuota(
  usage: UsageSnapshot,
  config: QuotaConfig = DEFAULT_QUOTA
): QuotaCheck {
  const checks = checkAllQuotas(usage, config);
  return checks.reduce((max, q) => (q.used > max.used ? q : max), checks[0]);
}

/**
 * Format quota check as a human-readable string.
 */
export function formatQuotaCheck(check: QuotaCheck): string {
  const status = check.exceeded ? "⚠️ EXCEEDED" : `${check.used}%`;
  return `${check.resource}: ${check.current}/${check.limit} (${status})`;
}

/**
 * Format all quotas as a summary.
 */
export function formatQuotaSummary(
  usage: UsageSnapshot,
  config: QuotaConfig = DEFAULT_QUOTA
): string {
  return checkAllQuotas(usage, config)
    .map(formatQuotaCheck)
    .join("\n");
}

/**
 * Check if a specific action would exceed quota.
 */
export function wouldExceedQuota(
  resource: keyof UsageSnapshot,
  usage: UsageSnapshot,
  config: QuotaConfig = DEFAULT_QUOTA,
  increment = 1
): boolean {
  const limits: Record<keyof UsageSnapshot, number> = {
    channels: config.maxChannels,
    members: config.maxMembers,
    agents: config.maxAgents,
    messagesToday: config.maxMessagesPerDay,
    storageUsedMb: config.maxFileSizeMb,
  };
  return (usage[resource] + increment) > limits[resource];
}
