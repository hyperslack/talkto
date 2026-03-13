/**
 * Agent alias utilities — short names and shortcut commands for agents.
 *
 * Allows humans to use short aliases instead of full agent names
 * (e.g., @c instead of @claude-code) and define custom shortcut
 * commands that expand into full agent instructions.
 */

export interface AgentAlias {
  alias: string;
  agentName: string;
  createdBy: string;
  createdAt: string;
}

export interface AgentShortcut {
  name: string;
  agentName: string;
  template: string;
  description?: string;
}

/**
 * In-memory alias registry.
 */
export class AliasRegistry {
  private aliases = new Map<string, AgentAlias>();
  private shortcuts = new Map<string, AgentShortcut>();

  /** Register an alias for an agent. */
  addAlias(alias: string, agentName: string, createdBy: string): AgentAlias {
    const normalized = alias.toLowerCase().trim();
    if (!normalized) throw new Error("Alias cannot be empty");
    if (normalized.includes(" ")) throw new Error("Alias cannot contain spaces");
    if (normalized.length > 20) throw new Error("Alias too long (max 20 chars)");

    const entry: AgentAlias = {
      alias: normalized,
      agentName,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    this.aliases.set(normalized, entry);
    return entry;
  }

  /** Resolve an alias to an agent name. Returns null if not found. */
  resolveAlias(alias: string): string | null {
    return this.aliases.get(alias.toLowerCase().trim())?.agentName ?? null;
  }

  /** Remove an alias. */
  removeAlias(alias: string): boolean {
    return this.aliases.delete(alias.toLowerCase().trim());
  }

  /** List all aliases, optionally filtered by agent. */
  listAliases(agentName?: string): AgentAlias[] {
    const all = Array.from(this.aliases.values());
    return agentName ? all.filter((a) => a.agentName === agentName) : all;
  }

  /** Register a shortcut command for an agent. */
  addShortcut(name: string, agentName: string, template: string, description?: string): AgentShortcut {
    const normalized = name.toLowerCase().trim();
    if (!normalized) throw new Error("Shortcut name cannot be empty");

    const shortcut: AgentShortcut = { name: normalized, agentName, template, description };
    this.shortcuts.set(`${agentName}:${normalized}`, shortcut);
    return shortcut;
  }

  /** Expand a shortcut command. Returns the template or null. */
  expandShortcut(agentName: string, shortcutName: string): string | null {
    return this.shortcuts.get(`${agentName}:${shortcutName.toLowerCase().trim()}`)?.template ?? null;
  }

  /** List shortcuts for an agent. */
  listShortcuts(agentName: string): AgentShortcut[] {
    return Array.from(this.shortcuts.values()).filter((s) => s.agentName === agentName);
  }

  /** Remove a shortcut. */
  removeShortcut(agentName: string, name: string): boolean {
    return this.shortcuts.delete(`${agentName}:${name.toLowerCase().trim()}`);
  }

  /**
   * Parse a message for @alias mentions and expand them to full agent names.
   * Returns the message with aliases replaced.
   */
  expandMentions(message: string): string {
    return message.replace(/@(\w+)/g, (match, name) => {
      const resolved = this.resolveAlias(name);
      return resolved ? `@${resolved}` : match;
    });
  }
}
