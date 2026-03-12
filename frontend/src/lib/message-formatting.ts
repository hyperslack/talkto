/**
 * Message formatting utilities — wraps text in markdown-style formatting.
 *
 * Used by the message composer to apply formatting shortcuts.
 */

export interface SelectionRange {
  start: number;
  end: number;
}

/** Wrap selected text with a delimiter (e.g. ** for bold). */
export function wrapSelection(
  text: string,
  selection: SelectionRange,
  delimiter: string,
): { text: string; cursor: number } {
  const before = text.slice(0, selection.start);
  const selected = text.slice(selection.start, selection.end);
  const after = text.slice(selection.end);

  if (selected.length === 0) {
    // No selection: insert delimiters with cursor in between
    return {
      text: `${before}${delimiter}${delimiter}${after}`,
      cursor: selection.start + delimiter.length,
    };
  }

  return {
    text: `${before}${delimiter}${selected}${delimiter}${after}`,
    cursor: selection.start + delimiter.length + selected.length + delimiter.length,
  };
}

/** Apply bold formatting (**text**). */
export function applyBold(text: string, selection: SelectionRange) {
  return wrapSelection(text, selection, "**");
}

/** Apply italic formatting (*text*). */
export function applyItalic(text: string, selection: SelectionRange) {
  return wrapSelection(text, selection, "*");
}

/** Apply strikethrough formatting (~~text~~). */
export function applyStrikethrough(text: string, selection: SelectionRange) {
  return wrapSelection(text, selection, "~~");
}

/** Apply inline code formatting (`text`). */
export function applyInlineCode(text: string, selection: SelectionRange) {
  return wrapSelection(text, selection, "`");
}

/** Apply code block formatting (```\ntext\n```). */
export function applyCodeBlock(
  text: string,
  selection: SelectionRange,
  language: string = "",
): { text: string; cursor: number } {
  const before = text.slice(0, selection.start);
  const selected = text.slice(selection.start, selection.end);
  const after = text.slice(selection.end);
  const open = "```" + language + "\n";
  const close = "\n```";

  if (selected.length === 0) {
    return {
      text: `${before}${open}${close}${after}`,
      cursor: selection.start + open.length,
    };
  }

  return {
    text: `${before}${open}${selected}${close}${after}`,
    cursor: selection.start + open.length + selected.length + close.length,
  };
}

/** Apply blockquote formatting (> text). */
export function applyBlockquote(text: string, selection: SelectionRange) {
  const before = text.slice(0, selection.start);
  const selected = text.slice(selection.start, selection.end);
  const after = text.slice(selection.end);

  const quoted = selected
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return {
    text: `${before}${quoted}${after}`,
    cursor: selection.start + quoted.length,
  };
}

/** Check if text contains any markdown formatting. */
export function hasFormatting(text: string): boolean {
  return /(\*\*.+?\*\*|\*.+?\*|~~.+?~~|`.+?`|```.+?```|^> )/ms.test(text);
}

/** Strip all markdown formatting from text. */
export function stripFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/```[\s\S]*?\n([\s\S]*?)\n```/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^> /gm, "");
}
