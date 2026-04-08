/** Tiny ranking helper for slash-command autocomplete. */
export function scoreSlashCommand(input: string, command: string): number {
  const q = input.toLowerCase().trim();
  const c = command.toLowerCase().trim();
  if (!q) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 75;
  if (c.includes(q)) return 25;
  return -1;
}
