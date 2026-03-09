/**
 * Slash command parser and executor.
 *
 * Supports built-in commands like /shrug, /me, /tableflip, /unflip.
 * Returns transformed content or null if not a slash command.
 */

export interface SlashCommandResult {
  /** The transformed message content to send (or null to suppress sending). */
  content: string | null;
  /** Whether the command was recognized. */
  recognized: boolean;
  /** Command name (without slash). */
  command: string;
  /** Error message if command is recognized but invalid. */
  error?: string;
}

const COMMANDS: Record<string, (args: string, senderName: string) => SlashCommandResult> = {
  shrug: (args) => ({
    content: args ? `${args} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯",
    recognized: true,
    command: "shrug",
  }),

  tableflip: (args) => ({
    content: args ? `${args} (╯°□°)╯︵ ┻━┻` : "(╯°□°)╯︵ ┻━┻",
    recognized: true,
    command: "tableflip",
  }),

  unflip: (args) => ({
    content: args ? `${args} ┬─┬ノ( º _ ºノ)` : "┬─┬ノ( º _ ºノ)",
    recognized: true,
    command: "unflip",
  }),

  me: (args, senderName) => {
    if (!args.trim()) {
      return { content: null, recognized: true, command: "me", error: "Usage: /me <action>" };
    }
    return {
      content: `_${senderName} ${args}_`,
      recognized: true,
      command: "me",
    };
  },

  lenny: () => ({
    content: "( ͡° ͜ʖ ͡°)",
    recognized: true,
    command: "lenny",
  }),

  disapprove: () => ({
    content: "ಠ_ಠ",
    recognized: true,
    command: "disapprove",
  }),
};

/** List available slash commands. */
export function listSlashCommands(): Array<{ command: string; description: string }> {
  return [
    { command: "/shrug", description: "Append ¯\\_(ツ)_/¯ to your message" },
    { command: "/tableflip", description: "Append (╯°□°)╯︵ ┻━┻ to your message" },
    { command: "/unflip", description: "Append ┬─┬ノ( º _ ºノ) to your message" },
    { command: "/me", description: "Send an action message (e.g., /me waves)" },
    { command: "/lenny", description: "Send ( ͡° ͜ʖ ͡°)" },
    { command: "/disapprove", description: "Send ಠ_ಠ" },
  ];
}

/** Parse and execute a slash command. Returns null if the message is not a slash command. */
export function parseSlashCommand(content: string, senderName: string): SlashCommandResult | null {
  if (!content.startsWith("/")) return null;

  const spaceIdx = content.indexOf(" ");
  const command = (spaceIdx === -1 ? content.slice(1) : content.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : content.slice(spaceIdx + 1);

  const handler = COMMANDS[command];
  if (!handler) {
    return { content: null, recognized: false, command, error: `Unknown command: /${command}` };
  }

  return handler(args, senderName);
}
