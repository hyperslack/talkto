import { describe, expect, it } from "vitest";
import { parseSlashCommand } from "./slash-command-parse";

describe("parseSlashCommand", () => {
  it("returns null for non-command input", () => {
    expect(parseSlashCommand("hello")).toBeNull();
  });

  it("parses command and args", () => {
    expect(parseSlashCommand("/invite @alex")).toEqual({
      command: "invite",
      args: "@alex",
    });
  });

  it("normalizes uppercase commands", () => {
    expect(parseSlashCommand("/HELP")).toEqual({ command: "help", args: "" });
  });
});
