/** Parse slash command input from composer content. */
export function parseSlashCommand(input: string): { command: string; args: string } | null {
  const text = input.trim();
  if (!text.startsWith("/")) return null;
  const [rawCommand, ...rest] = text.slice(1).split(/\s+/);
  if (!rawCommand) return null;
  return { command: rawCommand.toLowerCase(), args: rest.join(" ") };
}
