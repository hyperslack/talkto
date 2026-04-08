/** Human-readable typing indicator summary. */
export function formatTypingSummary(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return `${clean[0]} is typing…`;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]} are typing…`;
  return `${clean[0]}, ${clean[1]}, and ${clean.length - 2} others are typing…`;
}
