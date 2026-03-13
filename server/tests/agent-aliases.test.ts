import { describe, it, expect } from "bun:test";
import { AliasRegistry } from "../src/lib/agent-aliases";

describe("AliasRegistry", () => {
  describe("aliases", () => {
    it("adds and resolves aliases", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude-code", "user1");
      expect(reg.resolveAlias("c")).toBe("claude-code");
    });

    it("normalizes to lowercase", () => {
      const reg = new AliasRegistry();
      reg.addAlias("CC", "claude-code", "user1");
      expect(reg.resolveAlias("cc")).toBe("claude-code");
    });

    it("returns null for unknown aliases", () => {
      const reg = new AliasRegistry();
      expect(reg.resolveAlias("unknown")).toBeNull();
    });

    it("rejects empty aliases", () => {
      const reg = new AliasRegistry();
      expect(() => reg.addAlias("", "agent", "user1")).toThrow("empty");
    });

    it("rejects aliases with spaces", () => {
      const reg = new AliasRegistry();
      expect(() => reg.addAlias("my alias", "agent", "user1")).toThrow("spaces");
    });

    it("rejects aliases over 20 chars", () => {
      const reg = new AliasRegistry();
      expect(() => reg.addAlias("a".repeat(21), "agent", "user1")).toThrow("too long");
    });

    it("removes aliases", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude", "user1");
      expect(reg.removeAlias("c")).toBe(true);
      expect(reg.resolveAlias("c")).toBeNull();
    });

    it("lists all aliases", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude", "user1");
      reg.addAlias("g", "gpt", "user1");
      expect(reg.listAliases().length).toBe(2);
    });

    it("lists aliases filtered by agent", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude", "user1");
      reg.addAlias("cc", "claude", "user1");
      reg.addAlias("g", "gpt", "user1");
      expect(reg.listAliases("claude").length).toBe(2);
    });
  });

  describe("shortcuts", () => {
    it("adds and expands shortcuts", () => {
      const reg = new AliasRegistry();
      reg.addShortcut("review", "claude", "Please review the latest PR");
      expect(reg.expandShortcut("claude", "review")).toBe("Please review the latest PR");
    });

    it("returns null for unknown shortcuts", () => {
      const reg = new AliasRegistry();
      expect(reg.expandShortcut("claude", "unknown")).toBeNull();
    });

    it("lists shortcuts for an agent", () => {
      const reg = new AliasRegistry();
      reg.addShortcut("review", "claude", "Review PR");
      reg.addShortcut("test", "claude", "Run tests");
      reg.addShortcut("deploy", "gpt", "Deploy app");
      expect(reg.listShortcuts("claude").length).toBe(2);
    });

    it("removes shortcuts", () => {
      const reg = new AliasRegistry();
      reg.addShortcut("review", "claude", "Review PR");
      expect(reg.removeShortcut("claude", "review")).toBe(true);
      expect(reg.expandShortcut("claude", "review")).toBeNull();
    });
  });

  describe("expandMentions", () => {
    it("expands @alias to @agentName", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude-code", "user1");
      expect(reg.expandMentions("hey @c can you help?")).toBe("hey @claude-code can you help?");
    });

    it("leaves unknown mentions unchanged", () => {
      const reg = new AliasRegistry();
      expect(reg.expandMentions("hey @someone")).toBe("hey @someone");
    });

    it("expands multiple aliases in one message", () => {
      const reg = new AliasRegistry();
      reg.addAlias("c", "claude", "user1");
      reg.addAlias("g", "gpt", "user1");
      expect(reg.expandMentions("@c and @g please help")).toBe("@claude and @gpt please help");
    });
  });
});
