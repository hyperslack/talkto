/**
 * Lightweight sentiment analysis utilities.
 *
 * Uses a keyword-based approach (no ML models) to estimate message
 * sentiment. Useful for channel mood indicators and conversation
 * health tracking.
 */

export type Sentiment = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // -1 to 1
  positiveWords: string[];
  negativeWords: string[];
}

export interface ChannelMood {
  averageScore: number;
  sentiment: Sentiment;
  messageCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
}

const POSITIVE_WORDS = new Set([
  "good", "great", "awesome", "excellent", "amazing", "wonderful", "fantastic",
  "love", "loved", "like", "liked", "happy", "glad", "nice", "cool", "beautiful",
  "perfect", "best", "brilliant", "outstanding", "superb", "thanks", "thank",
  "helpful", "appreciate", "impressive", "enjoy", "excited", "fun", "well",
  "congratulations", "congrats", "yay", "hurray", "bravo", "cheers",
  "agree", "yes", "absolutely", "definitely", "right", "correct",
  "solved", "fixed", "works", "working", "success", "done", "ship", "shipped",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "horrible", "poor", "worst", "hate", "hated",
  "ugly", "annoying", "frustrated", "frustrating", "disappointing", "disappointed",
  "broken", "bug", "error", "fail", "failed", "failure", "crash", "crashed",
  "wrong", "issue", "problem", "stuck", "confused", "confusing", "slow",
  "unfortunately", "sadly", "regret", "sorry", "no", "not", "never",
  "difficult", "hard", "impossible", "complicated", "messy", "ugly",
  "blocked", "blocker", "critical", "urgent", "sucks",
]);

const NEGATION_WORDS = new Set(["not", "no", "never", "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", "won't"]);

/**
 * Analyze sentiment of a text message.
 */
export function analyzeSentiment(text: string): SentimentResult {
  if (!text.trim()) {
    return { sentiment: "neutral", score: 0, positiveWords: [], negativeWords: [] };
  }

  const words = text.toLowerCase().replace(/[^\w\s']/g, "").split(/\s+/).filter(Boolean);
  const positiveFound: string[] = [];
  const negativeFound: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : null;
    const isNegated = prevWord ? NEGATION_WORDS.has(prevWord) : false;

    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) {
        negativeFound.push(word);
      } else {
        positiveFound.push(word);
      }
    } else if (NEGATIVE_WORDS.has(word) && !NEGATION_WORDS.has(word)) {
      if (isNegated) {
        positiveFound.push(word);
      } else {
        negativeFound.push(word);
      }
    }
  }

  const total = positiveFound.length + negativeFound.length;
  const score = total === 0
    ? 0
    : (positiveFound.length - negativeFound.length) / total;

  let sentiment: Sentiment = "neutral";
  if (score > 0.1) sentiment = "positive";
  else if (score < -0.1) sentiment = "negative";

  return { sentiment, score, positiveWords: positiveFound, negativeWords: negativeFound };
}

/**
 * Compute aggregate mood from multiple sentiment results.
 */
export function computeChannelMood(results: SentimentResult[]): ChannelMood {
  if (results.length === 0) {
    return { averageScore: 0, sentiment: "neutral", messageCount: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 };
  }

  let totalScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const r of results) {
    totalScore += r.score;
    if (r.sentiment === "positive") positiveCount++;
    else if (r.sentiment === "negative") negativeCount++;
    else neutralCount++;
  }

  const averageScore = totalScore / results.length;
  let sentiment: Sentiment = "neutral";
  if (averageScore > 0.1) sentiment = "positive";
  else if (averageScore < -0.1) sentiment = "negative";

  return { averageScore, sentiment, messageCount: results.length, positiveCount, negativeCount, neutralCount };
}

/**
 * Get a mood emoji for display.
 */
export function moodEmoji(sentiment: Sentiment): string {
  switch (sentiment) {
    case "positive": return "😊";
    case "negative": return "😟";
    case "neutral": return "😐";
  }
}
