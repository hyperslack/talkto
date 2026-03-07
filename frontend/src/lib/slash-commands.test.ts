/** Tests for the slash commands framework. */
import { describe, it, expect } from "vitest";
import { parseSlashCommand, getSlashCommands, filterSlashCommands } from "./slash-commands";

const ctx = { channelId: "ch-1", channelName: "#general" };

describe("parseSlashCommand", () => {
  it("returns null for non-command input", () => {
    expect(parseSlashCommand("hello world", ctx)).toBeNull();
    expect(parseSlashCommand("", ctx)).toBeNull();
    expect(parseSlashCommand("  not a command  ", ctx)).toBeNull();
  });

  it("returns null for unknown commands", () => {
    expect(parseSlashCommand("/unknowncmd", ctx)).toBeNull();
  });

  it("/help returns handled with help text", () => {
    const result = parseSlashCommand("/help", ctx);
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.localMessage).toContain("Available Commands");
    expect(result!.localMessage).toContain("/help");
    expect(result!.localMessage).toContain("/clear");
  });

  it("/clear returns handled with clear action", () => {
    const result = parseSlashCommand("/clear", ctx);
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe("clear-messages");
  });

  it("/shrug appends kaomoji", () => {
    const result = parseSlashCommand("/shrug oh well", ctx);
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(false);
    expect(result!.localMessage).toContain("¯\\_(ツ)_/¯");
    expect(result!.localMessage).toContain("oh well");
  });

  it("/shrug without args returns just the kaomoji", () => {
    const result = parseSlashCommand("/shrug", ctx);
    expect(result!.localMessage).toBe("¯\\_(ツ)_/¯");
  });

  it("/tableflip appends table flip", () => {
    const result = parseSlashCommand("/tableflip rage", ctx);
    expect(result!.localMessage).toContain("(╯°□°)╯︵ ┻━┻");
    expect(result!.localMessage).toContain("rage");
  });

  it("/me wraps text in italics", () => {
    const result = parseSlashCommand("/me waves hello", ctx);
    expect(result!.handled).toBe(false);
    expect(result!.localMessage).toBe("_waves hello_");
  });

  it("is case-insensitive", () => {
    expect(parseSlashCommand("/HELP", ctx)).not.toBeNull();
    expect(parseSlashCommand("/Help", ctx)).not.toBeNull();
  });
});

describe("getSlashCommands", () => {
  it("returns all registered commands", () => {
    const cmds = getSlashCommands();
    expect(cmds.length).toBeGreaterThanOrEqual(4);
    expect(cmds.map((c) => c.name)).toContain("help");
    expect(cmds.map((c) => c.name)).toContain("clear");
  });
});

describe("filterSlashCommands", () => {
  it("filters by prefix", () => {
    const results = filterSlashCommands("he");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("help");
  });

  it("returns all commands for empty prefix", () => {
    const results = filterSlashCommands("");
    expect(results.length).toBe(getSlashCommands().length);
  });

  it("returns empty for non-matching prefix", () => {
    expect(filterSlashCommands("zzz")).toEqual([]);
  });
});
