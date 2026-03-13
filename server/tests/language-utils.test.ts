import { describe, it, expect } from "bun:test";
import {
  detectLanguage,
  isSupported,
  getLanguageInfo,
  createTranslationRequest,
  TranslationCache,
  SUPPORTED_LANGUAGES,
} from "../src/lib/language-utils";

describe("detectLanguage", () => {
  it("detects Japanese from hiragana/katakana", () => {
    expect(detectLanguage("こんにちは世界")).toBe("ja");
  });

  it("detects Korean from hangul", () => {
    expect(detectLanguage("안녕하세요")).toBe("ko");
  });

  it("detects Arabic script", () => {
    expect(detectLanguage("مرحبا بالعالم")).toBe("ar");
  });

  it("detects Spanish from common words", () => {
    expect(detectLanguage("el gato es grande y la casa es bonita")).toBe("es");
  });

  it("detects French from common words", () => {
    expect(detectLanguage("le chat est dans la maison avec les enfants")).toBe("fr");
  });

  it("detects German from common words", () => {
    expect(detectLanguage("der Hund ist nicht in der Stadt mit den Kindern")).toBe("de");
  });

  it("defaults to English for unrecognized Latin text", () => {
    expect(detectLanguage("hello world this is a test")).toBe("en");
  });

  it("returns unknown for empty text", () => {
    expect(detectLanguage("")).toBe("unknown");
    expect(detectLanguage("   ")).toBe("unknown");
  });
});

describe("isSupported", () => {
  it("returns true for supported languages", () => {
    expect(isSupported("en")).toBe(true);
    expect(isSupported("ja")).toBe(true);
  });

  it("returns false for unsupported languages", () => {
    expect(isSupported("xx")).toBe(false);
  });
});

describe("getLanguageInfo", () => {
  it("returns info for known language", () => {
    const info = getLanguageInfo("fr");
    expect(info).not.toBeNull();
    expect(info!.name).toBe("French");
    expect(info!.nativeName).toBe("Français");
  });

  it("returns null for unknown language", () => {
    expect(getLanguageInfo("zz")).toBeNull();
  });
});

describe("createTranslationRequest", () => {
  it("creates a valid translation request", () => {
    const req = createTranslationRequest("msg1", "hello world", "es");
    expect(req.messageId).toBe("msg1");
    expect(req.targetLanguage).toBe("es");
    expect(req.sourceLanguage).toBe("en");
  });

  it("throws for unsupported target language", () => {
    expect(() => createTranslationRequest("msg1", "hello", "xx")).toThrow("Unsupported target language");
  });

  it("uses provided source language", () => {
    const req = createTranslationRequest("msg1", "hello", "fr", "de");
    expect(req.sourceLanguage).toBe("de");
  });
});

describe("TranslationCache", () => {
  it("stores and retrieves translations", () => {
    const cache = new TranslationCache();
    cache.set({
      messageId: "msg1",
      originalContent: "hello",
      translatedContent: "hola",
      sourceLanguage: "en",
      targetLanguage: "es",
      translatedAt: new Date().toISOString(),
    });
    const result = cache.get("msg1", "es");
    expect(result).not.toBeNull();
    expect(result!.translatedContent).toBe("hola");
  });

  it("returns null for cache miss", () => {
    const cache = new TranslationCache();
    expect(cache.get("none", "en")).toBeNull();
  });

  it("tracks size", () => {
    const cache = new TranslationCache();
    expect(cache.size).toBe(0);
    cache.set({
      messageId: "m1", originalContent: "a", translatedContent: "b",
      sourceLanguage: "en", targetLanguage: "es", translatedAt: new Date().toISOString(),
    });
    expect(cache.size).toBe(1);
  });

  it("clears all entries", () => {
    const cache = new TranslationCache();
    cache.set({
      messageId: "m1", originalContent: "a", translatedContent: "b",
      sourceLanguage: "en", targetLanguage: "es", translatedAt: new Date().toISOString(),
    });
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
