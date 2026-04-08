/** Channel search matching helpers. */
export function matchesChannelSearch(name: string, query: string): boolean {
  const n = name.toLowerCase().replace(/^#/, "");
  const q = query.toLowerCase().trim().replace(/^#/, "");
  if (!q) return true;
  return n.includes(q);
}
