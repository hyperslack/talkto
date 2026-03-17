/**
 * Agent mention parsing utilities — extract and validate @mentions in messages.
 *
 * Handles @agent_name mentions with validation against known agents,
 * deduplication, and content transformation.
 */

export interface ParsedMention {
  name: string;
  startIndex: number;
  endIndex: number;
  isValid: boolean;
}

export interface MentionContext {
  mentionedNames: string[];
  validMentions: ParsedMention[];
  invalidMentions: ParsedMention[];
  hasMentions: boolean;
}

const MENTION_REGEX = /@([a-zA-Z0-9_-]+)/g;

/** Extract all @mentions from content. */
export function extractMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");
  while ((match = regex.exec(content)) !== null) {
    mentions.push({
      name: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      isValid: true, // default, caller validates
    });
  }
  return mentions;
}

/** Extract and validate mentions against a set of known agent names. */
export function parseMentions(content: string, knownAgents: Set<string>): MentionContext {
  const raw = extractMentions(content);
  const valid: ParsedMention[] = [];
  const invalid: ParsedMention[] = [];

  for (const mention of raw) {
    if (knownAgents.has(mention.name)) {
      mention.isValid = true;
      valid.push(mention);
    } else {
      mention.isValid = false;
      invalid.push(mention);
    }
  }

  const mentionedNames = [...new Set(valid.map((m) => m.name))];

  return {
    mentionedNames,
    validMentions: valid,
    invalidMentions: invalid,
    hasMentions: valid.length > 0,
  };
}

/** Get unique mentioned names from content. */
export function getUniqueMentions(content: string): string[] {
  const mentions = extractMentions(content);
  return [...new Set(mentions.map((m) => m.name))];
}

/** Count how many times each agent is mentioned. */
export function countMentions(content: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of extractMentions(content)) {
    counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  }
  return counts;
}

/** Replace @mentions with a formatted version (e.g., bold). */
export function highlightMentions(content: string, wrapper: (name: string) => string): string {
  return content.replace(MENTION_REGEX, (_, name) => wrapper(name));
}

/** Strip all @mentions from content, collapsing extra spaces. */
export function stripMentions(content: string): string {
  return content.replace(MENTION_REGEX, "").replace(/\s+/g, " ").trim();
}

/** Check if content mentions a specific agent. */
export function mentionsAgent(content: string, agentName: string): boolean {
  return extractMentions(content).some((m) => m.name === agentName);
}
