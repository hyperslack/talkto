/**
 * Language detection and translation metadata utilities.
 *
 * Provides basic heuristic language detection (no external API needed)
 * and translation request/response structures for agent-powered translation.
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
}

export interface TranslationRequest {
  messageId: string;
  content: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResult {
  messageId: string;
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedAt: string;
}

/** Supported languages with display info. */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
];

/** Character range patterns for heuristic detection. */
const SCRIPT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "ja", pattern: /[\u3040-\u309F\u30A0-\u30FF]/ },  // Hiragana/Katakana
  { code: "ko", pattern: /[\uAC00-\uD7AF\u1100-\u11FF]/ },  // Hangul
  { code: "zh", pattern: /[\u4E00-\u9FFF]/ },                 // CJK (if no JP/KR)
  { code: "ar", pattern: /[\u0600-\u06FF]/ },                 // Arabic
  { code: "hi", pattern: /[\u0900-\u097F]/ },                 // Devanagari
  { code: "ru", pattern: /[\u0400-\u04FF]/ },                 // Cyrillic
];

/** Common words for Latin-script language detection. */
const LATIN_MARKERS: Array<{ code: string; words: string[] }> = [
  { code: "es", words: ["el", "la", "los", "las", "de", "en", "que", "es", "por", "con", "del", "una"] },
  { code: "fr", words: ["le", "la", "les", "de", "des", "en", "est", "que", "une", "pour", "dans", "avec"] },
  { code: "de", words: ["der", "die", "das", "und", "ist", "von", "ein", "eine", "nicht", "mit", "auf", "den"] },
  { code: "it", words: ["il", "la", "di", "che", "è", "per", "una", "con", "del", "sono", "nella"] },
  { code: "pt", words: ["o", "os", "de", "que", "em", "um", "uma", "para", "com", "não", "da"] },
];

/**
 * Heuristic language detection based on character scripts and common words.
 * Returns a language code or "unknown".
 */
export function detectLanguage(text: string): string {
  if (!text.trim()) return "unknown";

  // Check script-based patterns first
  for (const { code, pattern } of SCRIPT_PATTERNS) {
    if (pattern.test(text)) return code;
  }

  // For Latin scripts, check common word frequency
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "unknown";

  let bestCode = "en";
  let bestScore = 0;

  for (const { code, words: markers } of LATIN_MARKERS) {
    const markerSet = new Set(markers);
    let score = 0;
    for (const w of words) {
      if (markerSet.has(w)) score++;
    }
    const ratio = score / words.length;
    if (ratio > bestScore && ratio > 0.1) {
      bestScore = ratio;
      bestCode = code;
    }
  }

  return bestCode;
}

/**
 * Check if a language code is supported.
 */
export function isSupported(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/**
 * Get language display info by code.
 */
export function getLanguageInfo(code: string): LanguageInfo | null {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? null;
}

/**
 * Create a translation request object.
 */
export function createTranslationRequest(
  messageId: string,
  content: string,
  targetLanguage: string,
  sourceLanguage?: string
): TranslationRequest {
  if (!isSupported(targetLanguage)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }
  return {
    messageId,
    content,
    targetLanguage,
    sourceLanguage: sourceLanguage ?? detectLanguage(content),
  };
}

/**
 * In-memory translation cache.
 */
export class TranslationCache {
  private cache = new Map<string, TranslationResult>();

  /** Cache key: messageId + targetLanguage */
  private key(messageId: string, targetLang: string): string {
    return `${messageId}:${targetLang}`;
  }

  get(messageId: string, targetLang: string): TranslationResult | null {
    return this.cache.get(this.key(messageId, targetLang)) ?? null;
  }

  set(result: TranslationResult): void {
    this.cache.set(this.key(result.messageId, result.targetLanguage), result);
  }

  has(messageId: string, targetLang: string): boolean {
    return this.cache.has(this.key(messageId, targetLang));
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
