/**
 * Client-side slash commands framework.
 *
 * Slash commands are processed before sending to the server.
 * Commands return either a local action or pass-through to the server.
 */

export interface SlashCommandContext {
  channelId: string;
  channelName?: string;
}

export interface SlashCommandResult {
  /** If true, the message was handled locally and should NOT be sent to the server. */
  handled: boolean;
  /** Optional local message to display (e.g., help text). */
  localMessage?: string;
  /** Optional action to perform. */
  action?: "clear-messages" | "scroll-to-bottom";
}

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: string, context: SlashCommandContext) => SlashCommandResult;
}

const commands: SlashCommand[] = [
  {
    name: "help",
    description: "Show available slash commands",
    usage: "/help",
    execute: () => {
      const lines = commands.map(
        (cmd) => `**/${cmd.name}** — ${cmd.description}\n  Usage: \`${cmd.usage}\``,
      );
      return {
        handled: true,
        localMessage: `### Available Commands\n\n${lines.join("\n\n")}`,
      };
    },
  },
  {
    name: "clear",
    description: "Clear visible messages (local only, does not delete)",
    usage: "/clear",
    execute: () => ({
      handled: true,
      action: "clear-messages" as const,
      localMessage: "Messages cleared from view. Refresh to restore.",
    }),
  },
  {
    name: "shrug",
    description: "Append ¯\\_(ツ)_/¯ to your message",
    usage: "/shrug [message]",
    execute: (args) => ({
      handled: false,
      localMessage: args ? `${args} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯",
    }),
  },
  {
    name: "tableflip",
    description: "Append (╯°□°)╯︵ ┻━┻ to your message",
    usage: "/tableflip [message]",
    execute: (args) => ({
      handled: false,
      localMessage: args ? `${args} (╯°□°)╯︵ ┻━┻` : "(╯°□°)╯︵ ┻━┻",
    }),
  },
  {
    name: "me",
    description: "Send an action message",
    usage: "/me <action>",
    execute: (args) => ({
      handled: false,
      localMessage: args ? `_${args}_` : undefined,
    }),
  },
];

/**
 * Parse and execute a slash command from user input.
 * Returns null if the input is not a slash command.
 */
export function parseSlashCommand(
  input: string,
  context: SlashCommandContext,
): SlashCommandResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  const name = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const cmd = commands.find((c) => c.name === name);
  if (!cmd) return null;

  return cmd.execute(args, context);
}

/**
 * Get all registered slash commands (for autocomplete).
 */
export function getSlashCommands(): readonly SlashCommand[] {
  return commands;
}

/**
 * Filter slash commands by prefix (for autocomplete dropdown).
 */
export function filterSlashCommands(prefix: string): SlashCommand[] {
  const lower = prefix.toLowerCase();
  return commands.filter((c) => c.name.startsWith(lower));
}
