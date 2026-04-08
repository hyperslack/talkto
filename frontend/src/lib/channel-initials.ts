/** Build compact initials for channel avatar chips. */
export function getChannelInitials(name: string): string {
  const normalized = name.replace(/^#/, "").trim();
  if (!normalized) return "#";

  const parts = normalized.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
