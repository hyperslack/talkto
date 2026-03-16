/**
 * Agent context window configuration — manages how much conversation
 * history each agent receives when invoked, with per-agent overrides.
 */

export interface ContextConfig {
  /** Maximum number of messages to include as context. */
  maxMessages: number;
  /** Maximum total characters across all context messages. */
  maxChars: number;
  /** Whether to include system messages in context. */
  includeSystemMessages: boolean;
  /** Whether to include messages from other agents. */
  includeAgentMessages: boolean;
  /** Whether to include pinned messages regardless of recency. */
  includePinned: boolean;
  /** Time window in minutes — only include messages from this recent. */
  timeWindowMinutes: number | null; // null = no time limit
}

const DEFAULT_CONFIG: ContextConfig = {
  maxMessages: 20,
  maxChars: 8000,
  includeSystemMessages: false,
  includeAgentMessages: true,
  includePinned: true,
  timeWindowMinutes: null,
};

/**
 * Store for per-agent context window configuration.
 */
export class AgentContextConfigStore {
  private configs = new Map<string, Partial<ContextConfig>>();
  private globalDefaults: ContextConfig;

  constructor(defaults?: Partial<ContextConfig>) {
    this.globalDefaults = { ...DEFAULT_CONFIG, ...defaults };
  }

  /**
   * Get the effective config for an agent (merges agent overrides with defaults).
   */
  getConfig(agentId: string): ContextConfig {
    const overrides = this.configs.get(agentId) ?? {};
    return { ...this.globalDefaults, ...overrides };
  }

  /**
   * Set overrides for a specific agent.
   */
  setConfig(agentId: string, overrides: Partial<ContextConfig>): ContextConfig {
    const validated = validateOverrides(overrides);
    this.configs.set(agentId, { ...this.configs.get(agentId), ...validated });
    return this.getConfig(agentId);
  }

  /**
   * Reset an agent's config to defaults.
   */
  resetConfig(agentId: string): void {
    this.configs.delete(agentId);
  }

  /**
   * Update global defaults.
   */
  setDefaults(defaults: Partial<ContextConfig>): void {
    Object.assign(this.globalDefaults, validateOverrides(defaults));
  }

  /**
   * Get the global defaults.
   */
  getDefaults(): ContextConfig {
    return { ...this.globalDefaults };
  }

  /**
   * List all agents with custom configurations.
   */
  listCustomized(): string[] {
    return [...this.configs.keys()];
  }

  /**
   * Check if an agent has custom configuration.
   */
  hasCustomConfig(agentId: string): boolean {
    return this.configs.has(agentId);
  }
}

/**
 * Apply context config to filter a list of messages.
 */
export function applyContextWindow(
  messages: Array<{
    content: string;
    senderType: "human" | "agent" | "system";
    isPinned?: boolean;
    createdAt: string;
  }>,
  config: ContextConfig
): typeof messages {
  let filtered = [...messages];

  // Time window filter
  if (config.timeWindowMinutes !== null) {
    const cutoff = new Date(Date.now() - config.timeWindowMinutes * 60000).toISOString();
    filtered = filtered.filter((m) => m.createdAt >= cutoff || (config.includePinned && m.isPinned));
  }

  // Type filters
  if (!config.includeSystemMessages) {
    filtered = filtered.filter((m) => m.senderType !== "system" || (config.includePinned && m.isPinned));
  }
  if (!config.includeAgentMessages) {
    filtered = filtered.filter((m) => m.senderType !== "agent" || (config.includePinned && m.isPinned));
  }

  // Message count limit
  filtered = filtered.slice(-config.maxMessages);

  // Character limit
  let totalChars = 0;
  const result: typeof messages = [];
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (totalChars + filtered[i].content.length > config.maxChars) break;
    totalChars += filtered[i].content.length;
    result.unshift(filtered[i]);
  }

  return result;
}

function validateOverrides(overrides: Partial<ContextConfig>): Partial<ContextConfig> {
  const result: Partial<ContextConfig> = { ...overrides };
  if (result.maxMessages !== undefined) {
    result.maxMessages = Math.max(1, Math.min(100, result.maxMessages));
  }
  if (result.maxChars !== undefined) {
    result.maxChars = Math.max(100, Math.min(100000, result.maxChars));
  }
  if (result.timeWindowMinutes !== undefined && result.timeWindowMinutes !== null) {
    result.timeWindowMinutes = Math.max(1, Math.min(10080, result.timeWindowMinutes)); // max 7 days
  }
  return result;
}
