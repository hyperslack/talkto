export function buildMessagePreview(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const slice = normalized.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const safe = lastSpace > Math.floor(maxLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${safe}…`;
}
