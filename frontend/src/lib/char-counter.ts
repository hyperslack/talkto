/** Message character counter utilities. */

export const MAX_MESSAGE_LENGTH = 4000;

export interface CharCountInfo {
  length: number;
  remaining: number;
  overLimit: boolean;
  /** Show counter when within this many chars of limit */
  shouldShow: boolean;
}

/** Threshold: start showing counter when this many chars remain. */
const SHOW_THRESHOLD = 200;

export function getCharCountInfo(text: string): CharCountInfo {
  const length = text.length;
  const remaining = MAX_MESSAGE_LENGTH - length;
  return {
    length,
    remaining,
    overLimit: remaining < 0,
    shouldShow: remaining <= SHOW_THRESHOLD,
  };
}
