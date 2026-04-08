import { describe, expect, it } from "vitest";
import { scoreSlashCommand } from "./slash-command-score";

describe("scoreSlashCommand", () => {
  it("ranks exact match highest", () => {
    expect(scoreSlashCommand("help", "help")).toBe(100);
  });

  it("ranks prefix above substring", () => {
    expect(scoreSlashCommand("he", "help")).toBeGreaterThan(
      scoreSlashCommand("el", "help"),
    );
  });

  it("returns -1 for no match", () => {
    expect(scoreSlashCommand("zzz", "help")).toBe(-1);
  });
});
