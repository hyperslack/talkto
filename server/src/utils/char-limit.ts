/**
 * Message character limit validation utilities.
 *
 * Provides remaining character count and validation feedback.
 */

/** Default maximum message length. */
export const MAX_MESSAGE_LENGTH = 4000;

export interface CharLimitResult {
  length: number;
  max: number;
  remaining: number;
  over_limit: boolean;
  feedback: string;
}

/**
 * Get character limit validation feedback for a message.
 */
export function getCharLimitFeedback(text: string, max = MAX_MESSAGE_LENGTH): CharLimitResult {
  const length = text.length;
  const remaining = max - length;
  const overLimit = remaining < 0;

  let feedback: string;
  if (overLimit) {
    feedback = `${Math.abs(remaining)} characters over limit`;
  } else if (remaining <= 100) {
    feedback = `${remaining} characters remaining`;
  } else if (remaining <= 500) {
    feedback = `${remaining} characters remaining`;
  } else {
    feedback = "";
  }

  return {
    length,
    max,
    remaining,
    over_limit: overLimit,
    feedback,
  };
}

/**
 * Check if a message is within the character limit.
 */
export function isWithinLimit(text: string, max = MAX_MESSAGE_LENGTH): boolean {
  return text.length <= max;
}

/**
 * Truncate a message to the character limit.
 */
export function truncateToLimit(text: string, max = MAX_MESSAGE_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
