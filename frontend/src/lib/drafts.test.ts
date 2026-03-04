/**
 * Tests for message draft persistence.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { getDraft, saveDraft, clearDraft, hasDraft } from "./drafts";

// Mock localStorage
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
} as Storage;

describe("Message Drafts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty string for no draft", () => {
    expect(getDraft("channel-1")).toBe("");
  });

  it("saves and retrieves a draft", () => {
    saveDraft("channel-1", "hello world");
    expect(getDraft("channel-1")).toBe("hello world");
  });

  it("clears a draft", () => {
    saveDraft("channel-1", "hello");
    clearDraft("channel-1");
    expect(getDraft("channel-1")).toBe("");
  });

  it("hasDraft returns true when draft exists", () => {
    saveDraft("channel-1", "hello");
    expect(hasDraft("channel-1")).toBe(true);
  });

  it("hasDraft returns false for empty draft", () => {
    expect(hasDraft("channel-1")).toBe(false);
  });

  it("saving empty string clears the draft", () => {
    saveDraft("channel-1", "hello");
    saveDraft("channel-1", "");
    expect(hasDraft("channel-1")).toBe(false);
  });

  it("drafts are isolated per channel", () => {
    saveDraft("channel-1", "draft one");
    saveDraft("channel-2", "draft two");
    expect(getDraft("channel-1")).toBe("draft one");
    expect(getDraft("channel-2")).toBe("draft two");
  });
});
