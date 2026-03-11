/**
 * Extract fenced code blocks from message content.
 *
 * Useful for building a "code snippets" view per channel or search.
 */

export interface CodeBlock {
  language: string | null;
  code: string;
  startIndex: number;
  endIndex: number;
}

const FENCED_BLOCK_RE = /```(\w+)?\n?([\s\S]*?)```/g;

/**
 * Extract all fenced code blocks from a string.
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex
  FENCED_BLOCK_RE.lastIndex = 0;

  while ((match = FENCED_BLOCK_RE.exec(content)) !== null) {
    blocks.push({
      language: match[1] ?? null,
      code: match[2].trimEnd(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return blocks;
}

/**
 * Check if a message contains any code blocks.
 */
export function hasCodeBlocks(content: string): boolean {
  FENCED_BLOCK_RE.lastIndex = 0;
  return FENCED_BLOCK_RE.test(content);
}

/**
 * Count code blocks in a message.
 */
export function countCodeBlocks(content: string): number {
  return extractCodeBlocks(content).length;
}

/**
 * Get unique languages used across code blocks.
 */
export function getLanguages(blocks: CodeBlock[]): string[] {
  const langs = new Set<string>();
  for (const b of blocks) {
    if (b.language) langs.add(b.language);
  }
  return Array.from(langs).sort();
}
