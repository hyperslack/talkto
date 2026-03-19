import { describe, it, expect } from "bun:test";
import {
  insertTimeSeparators,
  isTimeSeparator,
  formatDateLabel,
  countSeparators,
} from "../src/utils/time-separators";

const now = new Date("2026-03-19T12:00:00Z");

function msg(id: string, dateStr: string) {
  return { id, created_at: `${dateStr}T10:00:00Z` };
}

describe("insertTimeSeparators", () => {
  it("returns empty for empty input", () => {
    expect(insertTimeSeparators([], now)).toEqual([]);
  });

  it("inserts one separator for messages on the same day", () => {
    const messages = [msg("1", "2026-03-19"), msg("2", "2026-03-19")];
    const result = insertTimeSeparators(messages, now);
    expect(result).toHaveLength(3); // 1 separator + 2 messages
    expect(isTimeSeparator(result[0])).toBe(true);
    expect((result[0] as any).label).toBe("Today");
  });

  it("inserts separators at day boundaries", () => {
    const messages = [
      msg("1", "2026-03-18"),
      msg("2", "2026-03-18"),
      msg("3", "2026-03-19"),
    ];
    const result = insertTimeSeparators(messages, now);
    expect(result).toHaveLength(5); // 2 separators + 3 messages
    const seps = result.filter(isTimeSeparator);
    expect(seps).toHaveLength(2);
    expect(seps[0].label).toBe("Yesterday");
    expect(seps[1].label).toBe("Today");
  });

  it("preserves message order", () => {
    const messages = [msg("1", "2026-03-19"), msg("2", "2026-03-19")];
    const result = insertTimeSeparators(messages, now);
    const msgs = result.filter((r) => !isTimeSeparator(r));
    expect(msgs.map((m: any) => m.id)).toEqual(["1", "2"]);
  });
});

describe("isTimeSeparator", () => {
  it("returns true for separators", () => {
    expect(isTimeSeparator({ type: "separator", label: "Today", date: "2026-03-19" })).toBe(true);
  });

  it("returns false for messages", () => {
    expect(isTimeSeparator({ id: "1", created_at: "2026-03-19T10:00:00Z" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTimeSeparator(null)).toBe(false);
  });
});

describe("formatDateLabel", () => {
  it("returns Today for today's date", () => {
    expect(formatDateLabel("2026-03-19", now)).toBe("Today");
  });

  it("returns Yesterday for yesterday", () => {
    expect(formatDateLabel("2026-03-18", now)).toBe("Yesterday");
  });

  it("returns day name for this week", () => {
    const label = formatDateLabel("2026-03-15", now);
    expect(label).toBe("Sunday");
  });

  it("returns full date for older messages", () => {
    const label = formatDateLabel("2026-02-10", now);
    expect(label).toContain("February");
    expect(label).toContain("10");
  });
});

describe("countSeparators", () => {
  it("returns 0 for empty", () => {
    expect(countSeparators([])).toBe(0);
  });

  it("counts unique dates", () => {
    const messages = [
      msg("1", "2026-03-18"),
      msg("2", "2026-03-18"),
      msg("3", "2026-03-19"),
    ];
    expect(countSeparators(messages)).toBe(2);
  });
});
