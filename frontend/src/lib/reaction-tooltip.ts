/** Build reaction tooltip strings with sensible truncation. */
export function formatReactionTooltip(users: string[], maxNames = 3): string {
  const names = users.filter(Boolean);
  if (names.length === 0) return "No reactions yet";
  if (names.length <= maxNames) return names.join(", ");
  const head = names.slice(0, maxNames).join(", ");
  return `${head}, and ${names.length - maxNames} more`;
}
